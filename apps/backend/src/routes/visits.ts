import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  visitsTable,
  visitorsTable,
  sectorsTable,
  usersTable,
  serviceQueueTable,
} from "@visit-control/db";
import { eq, ilike, and, desc, sql, gte, lte, or, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import { parseIntParam } from "../lib/parse";
import {
  CancelVisitBody,
  CancelVisitParams,
  CheckoutVisitParams,
  CreateVisitBody,
  GetVisitParams,
  ListVisitsQueryParams,
  ReprintLabelParams,
  UpdateVisitBody,
  UpdateVisitParams,
} from "@visit-control/api-zod";
import { validate } from "../middlewares/validate";
import { isValidCpf, stripCpfMask } from "../lib/cpf";
import { publishServiceQueueUpdate } from "../lib/service-events";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

function nowDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

async function getOngoingVisit(visitorId: number) {
  const [visit] = await db
    .select({
      id: visitsTable.id,
      entryDate: visitsTable.entryDate,
      entryTime: visitsTable.entryTime,
      sectorId: visitsTable.sectorId,
      sectorName: sectorsTable.name,
    })
    .from(visitsTable)
    .leftJoin(sectorsTable, eq(visitsTable.sectorId, sectorsTable.id))
    .where(
      and(
        eq(visitsTable.visitorId, visitorId),
        eq(visitsTable.status, "ongoing"),
      ),
    )
    .limit(1);

  return visit ?? null;
}

function sendOngoingVisitConflict(
  res: Response,
  visit: NonNullable<Awaited<ReturnType<typeof getOngoingVisit>>>,
) {
  res.status(409).json({
    error: "Este visitante já possui uma visita em andamento.",
    code: "VISITOR_HAS_ONGOING_VISIT",
    visitId: visit.id,
    visit,
  });
}

function isOngoingVisitConstraintError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object") return false;
    const databaseError = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (
      databaseError.code === "23505" &&
      databaseError.constraint === "visits_one_ongoing_per_visitor"
    ) {
      return true;
    }
    current = databaseError.cause;
  }
  return false;
}

async function getFullVisit(id: number) {
  const rows = await db
    .select({
      id: visitsTable.id,
      visitorId: visitsTable.visitorId,
      sectorId: visitsTable.sectorId,
      responsible: visitsTable.responsible,
      reason: visitsTable.reason,
      notes: visitsTable.notes,
      status: visitsTable.status,
      entryDate: visitsTable.entryDate,
      entryTime: visitsTable.entryTime,
      entryUserId: visitsTable.entryUserId,
      exitDate: visitsTable.exitDate,
      exitTime: visitsTable.exitTime,
      exitUserId: visitsTable.exitUserId,
      cancelReason: visitsTable.cancelReason,
      createdAt: visitsTable.createdAt,
      visitorSnapshot: {
        name: visitsTable.visitorName,
        cpf: visitsTable.visitorCpf,
        phone: visitsTable.visitorPhone,
        company: visitsTable.visitorCompany,
        city: visitsTable.visitorCity,
      },
      visitor: {
        id: visitorsTable.id,
        name: visitorsTable.name,
        cpf: visitorsTable.cpf,
        phone: visitorsTable.phone,
        company: visitorsTable.company,
        city: visitorsTable.city,
        createdAt: visitorsTable.createdAt,
        updatedAt: visitorsTable.updatedAt,
      },
      sector: {
        id: sectorsTable.id,
        name: sectorsTable.name,
        abbreviation: sectorsTable.abbreviation,
        secretariat: sectorsTable.secretariat,
        status: sectorsTable.status,
        createdAt: sectorsTable.createdAt,
      },
    })
    .from(visitsTable)
    .leftJoin(visitorsTable, eq(visitsTable.visitorId, visitorsTable.id))
    .leftJoin(sectorsTable, eq(visitsTable.sectorId, sectorsTable.id))
    .where(eq(visitsTable.id, id));

  if (!rows[0]) return null;

  const row = rows[0];
  // Use snapshot columns when available (records created after this feature was added).
  // Fall back to the live visitor join for older records that predate snapshots.
  const hasSnapshot = row.visitorSnapshot.name !== null;

  // Fetch entry and exit users separately
  const [entryUser] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      login: usersTable.login,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, row.entryUserId));

  let exitUser = null;
  if (row.exitUserId) {
    const [eu] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        login: usersTable.login,
        role: usersTable.role,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, row.exitUserId));
    exitUser = eu
      ? {
          ...eu,
          createdAt: eu.createdAt.toISOString(),
          updatedAt: eu.updatedAt?.toISOString() ?? null,
        }
      : null;
  }

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    visitor: row.visitor
      ? {
          ...row.visitor,
          // Prefer immutable snapshot; fall back to live data for old records
          name: hasSnapshot
            ? (row.visitorSnapshot.name ?? row.visitor.name)
            : row.visitor.name,
          cpf: hasSnapshot ? row.visitorSnapshot.cpf : row.visitor.cpf,
          phone: hasSnapshot ? row.visitorSnapshot.phone : row.visitor.phone,
          company: hasSnapshot
            ? row.visitorSnapshot.company
            : row.visitor.company,
          city: hasSnapshot ? row.visitorSnapshot.city : row.visitor.city,
          createdAt: row.visitor.createdAt.toISOString(),
          updatedAt: row.visitor.updatedAt?.toISOString() ?? null,
        }
      : null,
    sector: row.sector
      ? { ...row.sector, createdAt: row.sector.createdAt.toISOString() }
      : null,
    entryUser: entryUser
      ? {
          ...entryUser,
          createdAt: entryUser.createdAt.toISOString(),
          updatedAt: entryUser.updatedAt?.toISOString() ?? null,
        }
      : null,
    exitUser,
  };
}

router.get(
  "/visits",
  requireAuth,
  validate("query", ListVisitsQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const {
      search,
      sectorId,
      status,
      dateFrom = nowDate(),
      dateTo = nowDate(),
      userId,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string | undefined>;

    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      res
        .status(400)
        .json({ error: "As datas devem estar no formato AAAA-MM-DD" });
      return;
    }

    if (dateFrom > dateTo) {
      res
        .status(400)
        .json({ error: "A data inicial não pode ser posterior à data final" });
      return;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: SQL[] = [];
    if (sectorId)
      conditions.push(eq(visitsTable.sectorId, parseInt(sectorId, 10)));
    if (status && ["ongoing", "finished", "cancelled"].includes(status)) {
      conditions.push(
        eq(visitsTable.status, status as "ongoing" | "finished" | "cancelled"),
      );
    }
    conditions.push(gte(visitsTable.entryDate, dateFrom));
    conditions.push(lte(visitsTable.entryDate, dateTo));
    if (userId)
      conditions.push(eq(visitsTable.entryUserId, parseInt(userId, 10)));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .leftJoin(visitorsTable, eq(visitsTable.visitorId, visitorsTable.id))
      .where(
        search
          ? and(
              whereClause,
              ilike(
                sql`COALESCE(${visitsTable.visitorName}, ${visitorsTable.name})`,
                `%${search}%`,
              ),
            )
          : whereClause,
      );

    const rows = await db
      .select({
        id: visitsTable.id,
        visitorId: visitsTable.visitorId,
        sectorId: visitsTable.sectorId,
        responsible: visitsTable.responsible,
        reason: visitsTable.reason,
        notes: visitsTable.notes,
        status: visitsTable.status,
        entryDate: visitsTable.entryDate,
        entryTime: visitsTable.entryTime,
        entryUserId: visitsTable.entryUserId,
        exitDate: visitsTable.exitDate,
        exitTime: visitsTable.exitTime,
        exitUserId: visitsTable.exitUserId,
        cancelReason: visitsTable.cancelReason,
        createdAt: visitsTable.createdAt,
        visitorSnapshot: {
          name: visitsTable.visitorName,
          cpf: visitsTable.visitorCpf,
          phone: visitsTable.visitorPhone,
          company: visitsTable.visitorCompany,
          city: visitsTable.visitorCity,
        },
        visitor: {
          id: visitorsTable.id,
          name: visitorsTable.name,
          cpf: visitorsTable.cpf,
          phone: visitorsTable.phone,
          company: visitorsTable.company,
          city: visitorsTable.city,
          createdAt: visitorsTable.createdAt,
          updatedAt: visitorsTable.updatedAt,
        },
        sector: {
          id: sectorsTable.id,
          name: sectorsTable.name,
          abbreviation: sectorsTable.abbreviation,
          secretariat: sectorsTable.secretariat,
          status: sectorsTable.status,
          createdAt: sectorsTable.createdAt,
        },
      })
      .from(visitsTable)
      .leftJoin(visitorsTable, eq(visitsTable.visitorId, visitorsTable.id))
      .leftJoin(sectorsTable, eq(visitsTable.sectorId, sectorsTable.id))
      .where(
        search
          ? and(
              whereClause,
              ilike(
                sql`COALESCE(${visitsTable.visitorName}, ${visitorsTable.name})`,
                `%${search}%`,
              ),
            )
          : whereClause,
      )
      .orderBy(desc(visitsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      data: rows.map((r) => {
        const snap = r.visitorSnapshot;
        const hasSnap = snap.name !== null;
        return {
          ...r,
          createdAt: r.createdAt.toISOString(),
          visitor: r.visitor
            ? {
                ...r.visitor,
                name: hasSnap ? (snap.name ?? r.visitor.name) : r.visitor.name,
                cpf: hasSnap ? snap.cpf : r.visitor.cpf,
                phone: hasSnap ? snap.phone : r.visitor.phone,
                company: hasSnap ? snap.company : r.visitor.company,
                city: hasSnap ? snap.city : r.visitor.city,
                createdAt: r.visitor.createdAt.toISOString(),
                updatedAt: r.visitor.updatedAt?.toISOString() ?? null,
              }
            : null,
          sector: r.sector
            ? { ...r.sector, createdAt: r.sector.createdAt.toISOString() }
            : null,
        };
      }),
      total: count,
      page: pageNum,
      limit: limitNum,
    });
  },
);

router.post(
  "/visits",
  requireAuth,
  validate("body", CreateVisitBody),
  async (req: Request, res: Response): Promise<void> => {
    const caller = (req as AuthReq).user;
    const {
      visitorId,
      visitorName,
      visitorCpf: rawVisitorCpf,
      visitorPhone,
      visitorCompany,
      visitorCity,
      updateVisitorData,
      sectorId,
      responsible,
      reason,
      notes,
    } = req.body ?? {};

    if (!sectorId) {
      res.status(400).json({ error: "Setor é obrigatório" });
      return;
    }

    const visitorCpfProvided = rawVisitorCpf !== undefined;
    const visitorCpf = rawVisitorCpf
      ? stripCpfMask(String(rawVisitorCpf))
      : rawVisitorCpf === ""
        ? null
        : undefined;
    if (visitorCpf && !isValidCpf(visitorCpf)) {
      res.status(400).json({ error: "CPF inválido." });
      return;
    }

    let finalVisitorId: number;
    let visitorSnapshot: {
      name: string;
      cpf: string;
      phone: string | null;
      company: string | null;
      city: string | null;
    };

    if (visitorId) {
      // Existing visitor
      const [existing] = await db
        .select()
        .from(visitorsTable)
        .where(eq(visitorsTable.id, parseInt(String(visitorId), 10)));
      if (!existing) {
        res.status(404).json({ error: "Visitante não encontrado" });
        return;
      }
      finalVisitorId = existing.id;

      const ongoingVisit = await getOngoingVisit(finalVisitorId);
      if (ongoingVisit) {
        sendOngoingVisitConflict(res, ongoingVisit);
        return;
      }

      if (updateVisitorData) {
        if (visitorCpfProvided && !visitorCpf) {
          res.status(400).json({ error: "CPF é obrigatório." });
          return;
        }
        if (visitorCpf) {
          const [duplicate] = await db
            .select({ id: visitorsTable.id })
            .from(visitorsTable)
            .where(
              and(
                eq(visitorsTable.cpf, visitorCpf),
                sql`${visitorsTable.id} != ${existing.id}`,
              ),
            );
          if (duplicate) {
            res.status(409).json({
              error: "Já existe um visitante cadastrado com este CPF.",
            });
            return;
          }
        }
        await db
          .update(visitorsTable)
          .set({
            name: visitorName ? String(visitorName) : existing.name,
            cpf: visitorCpfProvided
              ? (visitorCpf ?? existing.cpf)
              : existing.cpf,
            phone:
              visitorPhone !== undefined
                ? visitorPhone
                  ? String(visitorPhone)
                  : null
                : existing.phone,
            company:
              visitorCompany !== undefined
                ? visitorCompany
                  ? String(visitorCompany)
                  : null
                : existing.company,
            city:
              visitorCity !== undefined
                ? visitorCity
                  ? String(visitorCity)
                  : null
                : existing.city,
            updatedAt: new Date(),
          })
          .where(eq(visitorsTable.id, existing.id));
      }

      // Re-read the visitor to get its final state (after any update) for the snapshot
      const [refreshed] = await db
        .select()
        .from(visitorsTable)
        .where(eq(visitorsTable.id, finalVisitorId));
      visitorSnapshot = refreshed;
    } else {
      // New visitor
      if (!visitorName) {
        res.status(400).json({ error: "Nome do visitante é obrigatório" });
        return;
      }
      if (!visitorCpf) {
        res.status(400).json({ error: "CPF do visitante é obrigatório" });
        return;
      }
      if (visitorCpf) {
        const [duplicate] = await db
          .select({ id: visitorsTable.id })
          .from(visitorsTable)
          .where(eq(visitorsTable.cpf, visitorCpf));
        if (duplicate) {
          res.status(409).json({
            error: "Já existe um visitante cadastrado com este CPF.",
          });
          return;
        }
      }
      const [newVisitor] = await db
        .insert(visitorsTable)
        .values({
          name: String(visitorName),
          cpf: String(visitorCpf),
          phone: visitorPhone ? String(visitorPhone) : null,
          company: visitorCompany ? String(visitorCompany) : null,
          city: visitorCity ? String(visitorCity) : null,
        })
        .returning();
      finalVisitorId = newVisitor.id;
      visitorSnapshot = newVisitor;

      await auditAction({
        userId: caller.id,
        action: "create_visitor",
        ipAddress: req.ip,
        entityType: "visitor",
        entityId: newVisitor.id,
        newData: { name: visitorName },
      });
    }

    let visit: typeof visitsTable.$inferSelect;
    try {
      [visit] = await db
        .insert(visitsTable)
        .values({
          visitorId: finalVisitorId,
          // Immutable snapshot — preserves visitor data as it was at registration time
          visitorName: visitorSnapshot.name,
          visitorCpf: visitorSnapshot.cpf,
          visitorPhone: visitorSnapshot.phone,
          visitorCompany: visitorSnapshot.company,
          visitorCity: visitorSnapshot.city,
          sectorId: parseInt(String(sectorId), 10),
          responsible: responsible ? String(responsible) : null,
          reason: reason ? String(reason) : null,
          notes: notes ? String(notes) : null,
          status: "ongoing",
          entryDate: nowDate(),
          entryTime: nowTime(),
          entryUserId: caller.id,
        })
        .returning();
    } catch (error) {
      if (isOngoingVisitConstraintError(error)) {
        const ongoingVisit = await getOngoingVisit(finalVisitorId);
        if (ongoingVisit) {
          sendOngoingVisitConflict(res, ongoingVisit);
          return;
        }
      }
      throw error;
    }

    const [destinationSector] = await db
      .select({ queueEnabled: sectorsTable.queueEnabled })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, visit.sectorId));
    if (destinationSector?.queueEnabled) {
      await db.insert(serviceQueueTable).values({
        visitId: visit.id,
        sectorId: visit.sectorId,
      });
      publishServiceQueueUpdate();
    }

    await auditAction({
      userId: caller.id,
      action: "register_entry",
      ipAddress: req.ip,
      entityType: "visit",
      entityId: visit.id,
      newData: { visitorId: finalVisitorId, sectorId },
    });

    const full = await getFullVisit(visit.id);
    res.status(201).json(full);
  },
);

router.get(
  "/visits/:id",
  requireAuth,
  validate("params", GetVisitParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const visit = await getFullVisit(id);
    if (!visit) {
      res.status(404).json({ error: "Visita não encontrada" });
      return;
    }
    res.json(visit);
  },
);

router.patch(
  "/visits/:id",
  requireAuth,
  requireAdmin,
  validate("params", UpdateVisitParams),
  validate("body", UpdateVisitBody),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const [existing] = await db
      .select()
      .from(visitsTable)
      .where(eq(visitsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Visita não encontrada" });
      return;
    }

    const { sectorId, responsible, reason, notes, exitDate, exitTime } =
      req.body ?? {};
    const updates: Partial<typeof visitsTable.$inferInsert> = {};
    if (sectorId) updates.sectorId = parseInt(String(sectorId), 10);
    if (responsible !== undefined)
      updates.responsible = responsible ? String(responsible) : null;
    if (reason !== undefined) updates.reason = reason ? String(reason) : null;
    if (notes !== undefined) updates.notes = notes ? String(notes) : null;
    if (exitDate) updates.exitDate = String(exitDate);
    if (exitTime) updates.exitTime = String(exitTime);

    await db.update(visitsTable).set(updates).where(eq(visitsTable.id, id));

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "update_visit",
      ipAddress: req.ip,
      entityType: "visit",
      entityId: id,
      previousData: existing,
      newData: req.body,
    });

    const full = await getFullVisit(id);
    res.json(full);
  },
);

router.post(
  "/visits/:id/checkout",
  requireAuth,
  validate("params", CheckoutVisitParams),
  async (req: Request, res: Response): Promise<void> => {
    const caller = (req as AuthReq).user;
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const [visit] = await db
      .select()
      .from(visitsTable)
      .where(eq(visitsTable.id, id));
    if (!visit) {
      res.status(404).json({ error: "Visita não encontrada" });
      return;
    }
    if (visit.status !== "ongoing") {
      res
        .status(400)
        .json({ error: "Somente visitas em andamento podem ser finalizadas" });
      return;
    }

    await db
      .update(visitsTable)
      .set({
        status: "finished",
        exitDate: nowDate(),
        exitTime: nowTime(),
        exitUserId: caller.id,
      })
      .where(eq(visitsTable.id, id));

    await db
      .update(serviceQueueTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(serviceQueueTable.visitId, id));
    publishServiceQueueUpdate();

    await auditAction({
      userId: caller.id,
      action: "register_exit",
      ipAddress: req.ip,
      entityType: "visit",
      entityId: id,
    });

    const full = await getFullVisit(id);
    res.json(full);
  },
);

router.post(
  "/visits/:id/cancel",
  requireAuth,
  requireAdmin,
  validate("params", CancelVisitParams),
  validate("body", CancelVisitBody),
  async (req: Request, res: Response): Promise<void> => {
    const caller = (req as AuthReq).user;
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const { reason } = req.body ?? {};
    if (!reason) {
      res.status(400).json({ error: "Motivo do cancelamento é obrigatório" });
      return;
    }

    const [visit] = await db
      .select()
      .from(visitsTable)
      .where(eq(visitsTable.id, id));
    if (!visit) {
      res.status(404).json({ error: "Visita não encontrada" });
      return;
    }
    if (visit.status === "cancelled") {
      res.status(400).json({ error: "Visita já está cancelada" });
      return;
    }

    await db
      .update(visitsTable)
      .set({ status: "cancelled", cancelReason: String(reason) })
      .where(eq(visitsTable.id, id));

    await db
      .update(serviceQueueTable)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(eq(serviceQueueTable.visitId, id));
    publishServiceQueueUpdate();

    await auditAction({
      userId: caller.id,
      action: "cancel_visit",
      ipAddress: req.ip,
      entityType: "visit",
      entityId: id,
      newData: { reason },
    });

    const full = await getFullVisit(id);
    res.json(full);
  },
);

router.post(
  "/visits/:id/reprint",
  requireAuth,
  requireAdmin,
  validate("params", ReprintLabelParams),
  async (req: Request, res: Response): Promise<void> => {
    const caller = (req as AuthReq).user;
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );

    await auditAction({
      userId: caller.id,
      action: "reprint_label",
      ipAddress: req.ip,
      entityType: "visit",
      entityId: id,
    });

    res.json({ success: true, message: "Reimpressão registrada" });
  },
);

export default router;
