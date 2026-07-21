import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@visit-control/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import { parseIntParam } from "../lib/parse";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

function safeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _ph, ...rest } = u;
  return {
    ...rest,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt?.toISOString() ?? null,
  };
}

router.get("/users", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { search, role, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));
  if (role && ["admin", "receptionist"].includes(role)) {
    conditions.push(eq(usersTable.role, role as "admin" | "receptionist"));
  }
  if (status && ["active", "inactive"].includes(status)) {
    conditions.push(eq(usersTable.status, status as "active" | "inactive"));
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(usersTable.name);

  res.json(users.map(safeUser));
});

router.post("/users", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, login, password, role, status } = req.body ?? {};
  if (!name || !login || !password || !role) {
    res.status(400).json({ error: "Campos obrigatórios: nome, login, senha, perfil" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.login, login));
  if (existing.length > 0) {
    res.status(400).json({ error: "Login já está em uso" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      name: String(name),
      login: String(login),
      passwordHash,
      role: role as "admin" | "receptionist",
      status: (status as "active" | "inactive") ?? "active",
      mustChangePassword: role === "receptionist",
    })
    .returning();

  await auditAction({
    userId: (req as AuthReq).user.id,
    action: "create_user",
    ipAddress: req.ip,
    entityType: "user",
    entityId: user.id,
    newData: { name, login, role },
  });

  res.status(201).json(safeUser(user));
});

router.get("/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  res.json(safeUser(user));
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id!));
  if (!existing) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const { name, login, password, role, status } = req.body ?? {};
  const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
  if (name) updates.name = String(name);
  if (login) updates.login = String(login);
  if (password) {
    updates.passwordHash = await bcrypt.hash(String(password), 10);
    if ((role ?? existing.role) === "receptionist") {
      updates.mustChangePassword = true;
    }
  }
  if (role && ["admin", "receptionist"].includes(role)) updates.role = role;
  if (status && ["active", "inactive"].includes(status)) updates.status = status;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning();

  await auditAction({
    userId: (req as AuthReq).user.id,
    action: "update_user",
    ipAddress: req.ip,
    entityType: "user",
    entityId: id,
    previousData: safeUser(existing),
    newData: req.body,
  });

  res.json(safeUser(updated));
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }
  const caller = (req as AuthReq).user;
  if (caller.id === id) {
    res.status(400).json({ error: "Não é possível excluir o próprio usuário" });
    return;
  }

  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  await auditAction({
    userId: caller.id,
    action: "delete_user",
    ipAddress: req.ip,
    entityType: "user",
    entityId: id,
  });

  res.json({ success: true, message: "Usuário excluído" });
});

export default router;
