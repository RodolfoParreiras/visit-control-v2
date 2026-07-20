import bcrypt from "bcryptjs";
import { db, usersTable } from "@visit-control/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Garante que o usuário administrador padrão existe no banco.
 * Usa bcryptjs para gerar o hash — o mesmo que é usado na comparação
 * em auth.ts — evitando qualquer incompatibilidade de formato.
 */
export async function seedAdminUser(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.login, "admin"));

    if (existing) return;

    const passwordHash = await bcrypt.hash("admin", 10);

    await db.insert(usersTable).values({
      name: "Administrador",
      login: "admin",
      passwordHash,
      role: "admin",
      status: "active",
    });

    logger.info("Usuário administrador padrão criado (login: admin / senha: admin)");
  } catch (err) {
    logger.error({ err }, "Erro ao criar usuário administrador padrão");
  }
}
