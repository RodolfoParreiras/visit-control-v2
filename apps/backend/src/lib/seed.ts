import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { db, usersTable } from "@visit-control/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { type InitialAdmin, validateInitialAdmin } from "./initial-admin";

async function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode?.(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (key: string) => {
      if (key === "\u0003")
        return finish(new Error("Criação do administrador cancelada"));
      if (key === "\r" || key === "\n") return finish();
      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (key >= " ") value += key;
    };

    stdin.on("data", onData);
  });
}

async function promptInitialAdmin(): Promise<InitialAdmin> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      "Nenhum usuário existe e este processo não possui terminal interativo. " +
        "Inicie pelo scripts/start.cmd, scripts/start.ps1 ou scripts/start.sh para cadastrar o administrador no terminal.",
    );
  }

  stdout.write("\nConfiguração inicial do administrador\n");
  const terminal = createInterface({ input: stdin, output: stdout });
  const name = await terminal.question("Nome: ");
  const login = await terminal.question("Login: ");
  terminal.close();
  const password = await askHidden("Senha (mínimo 8 caracteres): ");
  const confirmation = await askHidden("Confirme a senha: ");
  if (password !== confirmation)
    throw new Error("As senhas informadas não coincidem");
  return validateInitialAdmin({ name, login, password });
}

/** Creates the first administrator only when the database has no users. */
export async function seedAdminUser(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable);

    if (count > 0) {
      // Protege instalações antigas que ainda conservem a credencial fixa.
      const [legacyAdmin] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.login, "admin"));
      if (
        legacyAdmin &&
        !legacyAdmin.mustChangePassword &&
        (await bcrypt.compare("admin", legacyAdmin.passwordHash))
      ) {
        await db
          .update(usersTable)
          .set({ mustChangePassword: true, updatedAt: new Date() })
          .where(eq(usersTable.id, legacyAdmin.id));
      }
      return;
    }

    const credentials = await promptInitialAdmin();
    const passwordHash = await bcrypt.hash(credentials.password, 10);

    await db.insert(usersTable).values({
      name: credentials.name,
      login: credentials.login,
      passwordHash,
      role: "admin",
      status: "active",
      mustChangePassword: false,
    });

    logger.info(
      { login: credentials.login },
      "Administrador inicial criado com sucesso",
    );
  } catch (err) {
    logger.error({ err }, "Erro ao configurar o administrador inicial");
    throw err;
  }
}
