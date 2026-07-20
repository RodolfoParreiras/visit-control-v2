import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@visit-control/db";
import { seedAdminUser } from "./lib/seed";

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  logger.fatal({ port: rawPort }, "Invalid PORT value");
  process.exit(1);
}

// Garante que o admin padrão existe antes de aceitar requisições
await seedAdminUser();

const server = app.listen(port, () => {
  logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "🚀 Servidor iniciado");
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Sinal de encerramento recebido — desligando servidor...");

  server.close(async () => {
    logger.info("Servidor HTTP encerrado");
    try {
      await pool.end();
      logger.info("Conexões com o banco de dados encerradas");
    } catch (err) {
      logger.error({ err }, "Erro ao encerrar conexões com o banco");
    }
    logger.info("Servidor encerrado com sucesso");
    process.exit(0);
  });

  // Força encerramento após 10s se o servidor não fechar
  setTimeout(() => {
    logger.error("Tempo limite de encerramento excedido — forçando saída");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Exceção não capturada");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Promise rejeitada sem tratamento");
  process.exit(1);
});
