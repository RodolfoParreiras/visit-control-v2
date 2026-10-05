import { Router, type IRouter, type Request, type Response } from "express";
import { db, sectorsTable, usersTable } from "@visit-control/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import {
  CreateSectorBody,
  DeleteSectorParams,
  GetSectorParams,
  ListSectorsQueryParams,
  UpdateSectorBody,
  UpdateSectorParams,
} from "@visit-control/api-zod";
import { validate } from "../middlewares/validate";
import { parseIntParam } from "../lib/parse";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

function formatSector(s: typeof sectorsTable.$inferSelect) {
  return { ...s, createdAt: s.createdAt.toISOString() };
}

router.get(
  "/sectors",
  requireAuth,
  validate("query", ListSectorsQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const { search, status } = req.query as Record<string, string | undefined>;
    const conditions: SQL[] = [];
    if (search) conditions.push(ilike(sectorsTable.name, `%${search}%`));
    if (status && ["active", "inactive"].includes(status)) {
      conditions.push(eq(sectorsTable.status, status as "active" | "inactive"));
    }

    const sectors = await db
      .select()
      .from(sectorsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sectorsTable.name);

    res.json(sectors.map(formatSector));
  },
);

router.post(
  "/sectors",
  requireAuth,
  requirePermission("manageSectors"),
  validate("body", CreateSectorBody),
  async (req: Request, res: Response): Promise<void> => {
    const { name, abbreviation, secretariat, status, queueEnabled, usesDesks } = req.body ?? {};
    if (!name || !abbreviation || !secretariat) {
      res
        .status(400)
        .json({ error: "Nome, sigla e secretaria são obrigatórios" });
      return;
    }

    const [sector] = await db
      .insert(sectorsTable)
      .values({
        name: String(name),
        abbreviation: String(abbreviation),
        secretariat: String(secretariat),
        status: (status as "active" | "inactive") ?? "active",
        queueEnabled: Boolean(queueEnabled),
        usesDesks: Boolean(queueEnabled && usesDesks),
      })
      .returning();

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "create_sector",
      ipAddress: req.ip,
      entityType: "sector",
      entityId: sector.id,
      newData: { name, abbreviation, secretariat },
    });

    res.status(201).json(formatSector(sector));
  },
);

router.get(
  "/sectors/:id",
  requireAuth,
  validate("params", GetSectorParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [sector] = await db
      .select()
      .from(sectorsTable)
      .where(eq(sectorsTable.id, id));
    if (!sector) {
      res.status(404).json({ error: "Setor não encontrado" });
      return;
    }
    res.json(formatSector(sector));
  },
);

router.patch(
  "/sectors/:id",
  requireAuth,
  requirePermission("manageSectors"),
  validate("params", UpdateSectorParams),
  validate("body", UpdateSectorBody),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [existing] = await db
      .select()
      .from(sectorsTable)
      .where(eq(sectorsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Setor não encontrado" });
      return;
    }

    const { name, abbreviation, secretariat, status, queueEnabled, usesDesks } = req.body ?? {};
    const updates: Partial<typeof sectorsTable.$inferInsert> = {};
    if (name) updates.name = String(name);
    if (abbreviation) updates.abbreviation = String(abbreviation);
    if (secretariat) updates.secretariat = String(secretariat);
    if (status && ["active", "inactive"].includes(status))
      updates.status = status;
    if (typeof queueEnabled === "boolean") updates.queueEnabled = queueEnabled;
    if (typeof usesDesks === "boolean") updates.usesDesks = usesDesks;
    if (queueEnabled === false) updates.usesDesks = false;

    const [updated] = await db
      .update(sectorsTable)
      .set(updates)
      .where(eq(sectorsTable.id, id))
      .returning();

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "update_sector",
      ipAddress: req.ip,
      entityType: "sector",
      entityId: id,
      previousData: existing,
      newData: req.body,
    });

    res.json(formatSector(updated));
  },
);

router.delete(
  "/sectors/:id",
  requireAuth,
  requirePermission("manageSectors"),
  validate("params", DeleteSectorParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [deleted] = await db
      .delete(sectorsTable)
      .where(eq(sectorsTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Setor não encontrado" });
      return;
    }

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "delete_sector",
      ipAddress: req.ip,
      entityType: "sector",
      entityId: id,
    });

    res.json({ success: true, message: "Setor excluído" });
  },
);

export default router;
