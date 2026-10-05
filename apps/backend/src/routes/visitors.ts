import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  visitorsTable,
  visitsTable,
  sectorsTable,
  usersTable,
  type PermissionKey,
} from "@visit-control/db";
import { eq, ilike, or, and, desc, sql, type SQL } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import { isValidCpf, stripCpfMask } from "../lib/cpf";
import { hasPermission } from "../lib/permissions";
import { isValidBirthDate } from "../lib/priority";
import { getDashboardPeriods } from "../lib/dashboard-periods";
import {
  CreateVisitorBody,
  GetVisitorParams,
  ListVisitorsQueryParams,
  SearchVisitorsQueryParams,
  UpdateVisitorBody,
  UpdateVisitorParams,
} from "@visit-control/api-zod";
import { validate } from "../middlewares/validate";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();
const CreateVisitorRequest = CreateVisitorBody.extend({
  cpf: CreateVisitorBody.shape.cpf.min(11),
});

function formatVisitor(v: typeof visitorsTable.$inferSelect) {
  return {
    ...v,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt?.toISOString() ?? null,
  };
}

router.get(
  "/visitors/search",
  requireAuth,
  requirePermission("viewVisitors", "registerVisit"),
  validate("query", SearchVisitorsQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const q = req.query.q as string | undefined;
    if (!q || q.trim().length < 2) {
      res.json([]);
      return;
    }

    const visitors = await db
      .select()
      .from(visitorsTable)
      .where(
        or(
          ilike(visitorsTable.name, `%${q}%`),
          ilike(visitorsTable.cpf, `%${q}%`),
        ),
      )
      .orderBy(visitorsTable.name)
      .limit(10);

    res.json(visitors.map(formatVisitor));
  },
);

router.get(
  "/visitors",
  requireAuth,
  requirePermission("viewVisitors", "registerVisit"),
  validate("query", ListVisitorsQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const {
      search,
      cpf,
      phone,
      company,
      city,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: SQL[] = [];
    if (search) conditions.push(ilike(visitorsTable.name, `%${search}%`));
    if (cpf) conditions.push(ilike(visitorsTable.cpf, `%${cpf}%`));
    if (phone) conditions.push(ilike(visitorsTable.phone, `%${phone}%`));
    if (company) conditions.push(ilike(visitorsTable.company, `%${company}%`));
    if (city) conditions.push(ilike(visitorsTable.city, `%${city}%`));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitorsTable)
      .where(whereClause);

    const visitors = await db
      .select()
      .from(visitorsTable)
      .where(whereClause)
      .orderBy(visitorsTable.name)
      .limit(limitNum)
      .offset(offset);

    res.json({
      data: visitors.map(formatVisitor),
      total: count,
      page: pageNum,
      limit: limitNum,
    });
  },
);

router.post(
  "/visitors",
  requireAuth,
  requirePermission("createVisitor"),
  validate("body", CreateVisitorRequest),
  async (req: Request, res: Response): Promise<void> => {
    const { name, phone, company, city, birthDate } = req.body ?? {};
    let { cpf } = req.body ?? {};
    if (!name || !cpf) {
      res.status(400).json({ error: "Nome e CPF são obrigatórios" });
      return;
    }
    if (!birthDate) {
      res.status(400).json({ error: "Data de nascimento é obrigatória" });
      return;
    }
    if (!isValidBirthDate(birthDate, getDashboardPeriods().today)) {
      res.status(400).json({ error: "Data de nascimento inválida" });
      return;
    }

    cpf = stripCpfMask(String(cpf));
    if (!isValidCpf(cpf)) {
      res.status(400).json({ error: "CPF inválido." });
      return;
    }
    const [existing] = await db
      .select({ id: visitorsTable.id })
      .from(visitorsTable)
      .where(eq(visitorsTable.cpf, cpf));
    if (existing) {
      res
        .status(409)
        .json({ error: "Já existe um visitante cadastrado com este CPF." });
      return;
    }

    const [visitor] = await db
      .insert(visitorsTable)
      .values({
        name: String(name),
        cpf: String(cpf),
        phone: phone ? String(phone) : null,
        company: company ? String(company) : null,
        city: city ? String(city) : null,
        birthDate: String(birthDate),
      })
      .returning();

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "create_visitor",
      ipAddress: req.ip,
      entityType: "visitor",
      entityId: visitor.id,
      newData: { name, cpf, phone, company, city, birthDate },
    });

    res.status(201).json(formatVisitor(visitor));
  },
);

router.get(
  "/visitors/:id",
  requireAuth,
  requirePermission("viewVisitors", "registerVisit"),
  validate("params", GetVisitorParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const [visitor] = await db
      .select()
      .from(visitorsTable)
      .where(eq(visitorsTable.id, id));
    if (!visitor) {
      res.status(404).json({ error: "Visitante não encontrado" });
      return;
    }

    const visits = await db
      .select({
        id: visitsTable.id,
        visitorId: visitsTable.visitorId,
        sectorId: visitsTable.sectorId,
        sector: {
          id: sectorsTable.id,
          name: sectorsTable.name,
          abbreviation: sectorsTable.abbreviation,
          secretariat: sectorsTable.secretariat,
          status: sectorsTable.status,
          createdAt: sectorsTable.createdAt,
        },
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
      })
      .from(visitsTable)
      .leftJoin(sectorsTable, eq(visitsTable.sectorId, sectorsTable.id))
      .where(eq(visitsTable.visitorId, id))
      .orderBy(desc(visitsTable.createdAt));

    res.json({
      ...formatVisitor(visitor),
      visits: visits.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        sector: v.sector
          ? { ...v.sector, createdAt: v.sector.createdAt.toISOString() }
          : null,
      })),
    });
  },
);

router.patch(
  "/visitors/:id",
  requireAuth,
  validate("params", UpdateVisitorParams),
  validate("body", UpdateVisitorBody),
  async (req: Request, res: Response): Promise<void> => {
    const caller = (req as AuthReq).user;
    const fieldPermissions: Record<string, PermissionKey> = {
      name: "editVisitorName",
      cpf: "editVisitorCpf",
      birthDate: "editVisitorBirthDate",
      phone: "editVisitorPhone",
      company: "editVisitorCompany",
      city: "editVisitorCity",
    };
    const forbiddenFields = Object.keys(req.body ?? {}).filter((field) => {
      const permission = fieldPermissions[field];
      return !permission || !hasPermission(caller, permission);
    });
    if (forbiddenFields.length > 0) {
      res.status(403).json({
        error: "Você não possui permissão para editar estes campos do visitante.",
        fields: forbiddenFields,
      });
      return;
    }

    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10,
    );
    const [existing] = await db
      .select()
      .from(visitorsTable)
      .where(eq(visitorsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Visitante não encontrado" });
      return;
    }

    const { name, phone, company, city, birthDate } = req.body ?? {};
    let { cpf } = req.body ?? {};
    const updates: Partial<typeof visitorsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name) updates.name = String(name);
    if (birthDate !== undefined) {
      if (!isValidBirthDate(birthDate, getDashboardPeriods().today)) {
        res.status(400).json({ error: "Data de nascimento inválida" });
        return;
      }
      updates.birthDate = String(birthDate);
    }
    if (cpf !== undefined) {
      if (!cpf) {
        res.status(400).json({ error: "CPF é obrigatório." });
        return;
      }
      cpf = stripCpfMask(String(cpf));
      if (!isValidCpf(cpf)) {
        res.status(400).json({ error: "CPF inválido." });
        return;
      }
      const [duplicate] = await db
        .select({ id: visitorsTable.id })
        .from(visitorsTable)
        .where(
          and(eq(visitorsTable.cpf, cpf), sql`${visitorsTable.id} != ${id}`),
        );
      if (duplicate) {
        res
          .status(409)
          .json({ error: "Já existe um visitante cadastrado com este CPF." });
        return;
      }
      updates.cpf = String(cpf);
    }
    if (phone !== undefined) updates.phone = phone ? String(phone) : null;
    if (company !== undefined)
      updates.company = company ? String(company) : null;
    if (city !== undefined) updates.city = city ? String(city) : null;

    const [updated] = await db
      .update(visitorsTable)
      .set(updates)
      .where(eq(visitorsTable.id, id))
      .returning();

    await auditAction({
      userId: caller.id,
      action: "update_visitor",
      ipAddress: req.ip,
      entityType: "visitor",
      entityId: id,
      previousData: formatVisitor(existing),
      newData: req.body,
    });

    res.json(formatVisitor(updated));
  },
);

export default router;
