import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  db,
  defaultPermissionsForRole,
  resolvePermissions,
  usersTable,
  type UserPermissions,
  type UserRole,
} from "@visit-control/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin, requirePermission } from "../middlewares/auth";
import { publicUser } from "../lib/permissions";
import { auditAction } from "../lib/audit";
import {
  CreateUserBody,
  DeleteUserParams,
  GetUserParams,
  ListUsersQueryParams,
  UpdateUserBody,
  UpdateUserParams,
} from "@visit-control/api-zod";
import { validate } from "../middlewares/validate";
import { parseIntParam } from "../lib/parse";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();
const INITIAL_PASSWORD = "Mudar@123!";

const CreateUserRequest = CreateUserBody;
const UpdateUserRequest = UpdateUserBody;

/**
 * O setor vincula o usuário a uma Central de Atendimento. É obrigatório para
 * quem tem acesso à central (exceto administradores) e descartado nos demais.
 */
function resolveSector(
  role: UserRole,
  permissions: UserPermissions,
  sectorId: unknown,
): { sectorId: number | null } | { error: string } {
  const value = sectorId == null || sectorId === "" ? null : Number(sectorId);
  if (value !== null && (!Number.isInteger(value) || value <= 0)) {
    return { error: "Setor inválido" };
  }
  if (role !== "admin" && !permissions.accessServiceCenter) return { sectorId: null };
  if (role !== "admin" && value === null) {
    return { error: "Informe o setor de atendimento para usuários com acesso à Central de Atendimento" };
  }
  return { sectorId: value };
}

router.get(
  "/users",
  requireAuth,
  requirePermission("viewAudit"),
  validate("query", ListUsersQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const { search, role, status } = req.query as Record<
      string,
      string | undefined
    >;
    const conditions: SQL[] = [];
    if (search) conditions.push(ilike(usersTable.name, `%${search}%`));
    if (role && ["admin", "receptionist", "attendant"].includes(role)) {
      conditions.push(eq(usersTable.role, role as "admin" | "receptionist" | "attendant"));
    }
    if (status && ["active", "inactive"].includes(status)) {
      conditions.push(eq(usersTable.status, status as "active" | "inactive"));
    }

    const users = await db
      .select()
      .from(usersTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(usersTable.name);

    res.json(users.map(publicUser));
  },
);

router.post(
  "/users",
  requireAuth,
  requireAdmin,
  validate("body", CreateUserRequest),
  async (req: Request, res: Response): Promise<void> => {
    const { name, login, role, status, sectorId, permissions } = req.body ?? {};
    if (!name || !login || !role) {
      res
        .status(400)
        .json({ error: "Campos obrigatórios: nome, login, perfil" });
      return;
    }
    const userRole = role as UserRole;
    const userPermissions = resolvePermissions(userRole, permissions);
    const sector = resolveSector(userRole, userPermissions, sectorId);
    if ("error" in sector) {
      res.status(400).json({ error: sector.error });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.login, login));
    if (existing.length > 0) {
      res.status(400).json({ error: "Login já está em uso" });
      return;
    }

    const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        name: String(name),
        login: String(login),
        passwordHash,
        role: userRole,
        sectorId: sector.sectorId,
        status: (status as "active" | "inactive") ?? "active",
        mustChangePassword: true,
        permissions: userPermissions,
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

    res.status(201).json(publicUser(user));
  },
);

router.get(
  "/users/:id",
  requireAuth,
  requireAdmin,
  validate("params", GetUserParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    res.json(publicUser(user));
  },
);

router.patch(
  "/users/:id",
  requireAuth,
  requireAdmin,
  validate("params", UpdateUserParams),
  validate("body", UpdateUserRequest),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id!));
    if (!existing) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    const { name, login, role, status, sectorId, permissions } = req.body ?? {};
    const caller = (req as AuthReq).user;
    const nextRole: UserRole = role ?? existing.role;
    if (caller.id === id && existing.role === "admin" && nextRole !== "admin") {
      res.status(400).json({ error: "Você não pode remover o seu próprio perfil de administrador" });
      return;
    }

    // Ao trocar o perfil sem enviar permissões, aplica os padrões do novo perfil.
    const nextPermissions =
      permissions !== undefined
        ? resolvePermissions(nextRole, permissions, resolvePermissions(nextRole, existing.permissions))
        : nextRole === existing.role
          ? resolvePermissions(nextRole, existing.permissions)
          : defaultPermissionsForRole(nextRole);
    const sector = resolveSector(
      nextRole,
      nextPermissions,
      sectorId !== undefined ? sectorId : existing.sectorId,
    );
    if ("error" in sector) {
      res.status(400).json({ error: sector.error });
      return;
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {
      updatedAt: new Date(),
      role: nextRole,
      permissions: nextPermissions,
      sectorId: sector.sectorId,
    };
    if (name) updates.name = String(name);
    if (login) updates.login = String(login);
    if (status && ["active", "inactive"].includes(status))
      updates.status = status;

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
      previousData: publicUser(existing),
      newData: req.body ?? {},
    });

    res.json(publicUser(updated));
  },
);

router.post(
  "/users/:id/reset-password",
  requireAuth,
  requireAdmin,
  validate("params", UpdateUserParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 10);
    await db
      .update(usersTable)
      .set({
        passwordHash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id));

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "reset_user_password",
      ipAddress: req.ip,
      entityType: "user",
      entityId: id,
      previousData: { mustChangePassword: existing.mustChangePassword },
      newData: { mustChangePassword: true },
    });

    res.json({
      success: true,
      message: "Senha redefinida. O usuário deverá alterá-la no próximo acesso.",
    });
  },
);

router.delete(
  "/users/:id",
  requireAuth,
  requireAdmin,
  validate("params", DeleteUserParams),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseIntParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const caller = (req as AuthReq).user;
    if (caller.id === id) {
      res
        .status(400)
        .json({ error: "Não é possível excluir o próprio usuário" });
      return;
    }

    const [deleted] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning();
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
  },
);

export default router;
