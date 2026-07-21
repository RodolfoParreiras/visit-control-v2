import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@visit-control/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt";
import { auditAction } from "../lib/audit";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Login-specific rate limiter: 10 tentativas por IP a cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente." },
  skipSuccessfulRequests: true, // só conta falhas
});

router.post("/auth/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { login, password } = req.body ?? {};

  if (!login || !password) {
    res.status(400).json({ error: "Login e senha são obrigatórios" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.login, String(login)));

  if (!user || user.status !== "active") {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }

  const token = signToken({ id: user.id, role: user.role });

  await auditAction({
    userId: user.id,
    action: "login",
    ipAddress: req.ip,
    entityType: "user",
    entityId: user.id,
  });

  const { passwordHash: _ph, ...safeUser } = user;
  res.json({ token, user: { ...safeUser, updatedAt: user.updatedAt?.toISOString() ?? null, createdAt: user.createdAt.toISOString() } });
});

router.post("/auth/logout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user?: { id: number } }).user;
  if (user) {
    await auditAction({
      userId: user.id,
      action: "logout",
      ipAddress: req.ip,
      entityType: "user",
      entityId: user.id,
    });
  }
  res.json({ success: true, message: "Desconectado com sucesso" });
});

router.post("/auth/change-password", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = (req as Request & { user: typeof usersTable.$inferSelect }).user;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres" });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: "A nova senha deve ser diferente da senha atual" });
    return;
  }

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "A senha atual está incorreta" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id))
    .returning();

  await auditAction({
    userId: user.id,
    action: "change_password",
    ipAddress: req.ip,
    entityType: "user",
    entityId: user.id,
  });

  const { passwordHash: _ph, ...safeUser } = updated;
  res.json({
    ...safeUser,
    updatedAt: updated.updatedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as Request & { user: typeof usersTable.$inferSelect }).user;
  const { passwordHash: _ph, ...safeUser } = user;
  res.json({ ...safeUser, updatedAt: user.updatedAt?.toISOString() ?? null, createdAt: user.createdAt.toISOString() });
});

export default router;
