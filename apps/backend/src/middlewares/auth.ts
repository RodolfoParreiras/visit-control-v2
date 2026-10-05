import {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, usersTable, type PermissionKey } from "@visit-control/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/jwt";
import { hasPermission } from "../lib/permissions";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: { id: number; role: string };
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.id));

  if (!user || user.status !== "active") {
    res.status(401).json({ error: "Usuário não encontrado ou inativo" });
    return;
  }

  (req as Request & { user: typeof user }).user = user;

  const allowedWhileChangingPassword = ["/auth/me", "/auth/logout", "/auth/change-password"];
  if (user.mustChangePassword && !allowedWhileChangingPassword.includes(req.path)) {
    res.status(403).json({ error: "Você precisa alterar sua senha antes de continuar" });
    return;
  }

  next();
}

/** Exige ao menos uma das permissões informadas (administradores sempre passam). */
export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: typeof usersTable.$inferSelect }).user;
    if (!user || !hasPermission(user, ...keys)) {
      res.status(403).json({ error: "Você não possui permissão para esta ação" });
      return;
    }
    next();
  };
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as Request & { user?: { role: string } }).user;
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }
  next();
}
