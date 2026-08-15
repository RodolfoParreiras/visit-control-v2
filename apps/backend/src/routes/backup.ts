import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { Router, type IRouter, type Request, type Response } from "express";
import { usersTable } from "@visit-control/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import { logger } from "../lib/logger";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();
let backupInProgress = false;

function backupTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${value("year")}${value("month")}${value("day")}_${value("hour")}${value("minute")}${value("second")}`;
}

async function runPgDump(outputPath: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");

  const connection = new URL(databaseUrl);
  const database = decodeURIComponent(connection.pathname.replace(/^\//, ""));
  const args = [
    "--host",
    connection.hostname,
    "--port",
    connection.port || "5432",
    "--username",
    decodeURIComponent(connection.username),
    "--dbname",
    database,
    "--format=plain",
    "--no-owner",
    "--no-acl",
    "--clean",
    "--if-exists",
  ];
  const pgDump = spawn("pg_dump", args, {
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(connection.password),
      ...(connection.searchParams.get("sslmode")
        ? { PGSSLMODE: connection.searchParams.get("sslmode") ?? undefined }
        : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  pgDump.stderr.setEncoding("utf8");
  pgDump.stderr.on("data", (chunk: string) => {
    if (stderr.length < 8_000) stderr += chunk;
  });

  const processFinished = new Promise<void>((resolve, reject) => {
    pgDump.once("error", (error) => reject(error));
    pgDump.once("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(stderr.trim() || `pg_dump encerrou com código ${code}.`),
        );
    });
  });

  try {
    await Promise.all([
      pipeline(
        pgDump.stdout,
        createGzip({ level: 9 }),
        createWriteStream(outputPath, { flags: "wx" }),
      ),
      processFinished,
    ]);
  } catch (error) {
    if (!pgDump.killed) pgDump.kill();
    throw error;
  }
}

router.post(
  "/admin/backup",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    if (backupInProgress) {
      res.status(409).json({
        error: "Já existe um backup sendo gerado. Aguarde a conclusão.",
      });
      return;
    }

    backupInProgress = true;
    let temporaryDirectory: string | null = null;

    try {
      temporaryDirectory = await mkdtemp(
        join(tmpdir(), "visit-control-backup-"),
      );
      const filename = `visit_control_${backupTimestamp()}.sql.gz`;
      const outputPath = join(temporaryDirectory, filename);

      await runPgDump(outputPath);
      await auditAction({
        userId: (req as AuthReq).user.id,
        action: "generate_backup",
        ipAddress: req.ip,
        entityType: "system",
        newData: { filename },
      });

      backupInProgress = false;
      res.setHeader("Cache-Control", "no-store");
      const directoryToRemove = temporaryDirectory;
      res.download(outputPath, filename, (error) => {
        void rm(directoryToRemove, { recursive: true, force: true }).catch(
          (cleanupError) =>
            logger.warn(
              { err: cleanupError },
              "Não foi possível remover o backup temporário",
            ),
        );
        if (error) {
          logger.error({ err: error }, "Falha ao enviar backup administrativo");
          if (!res.headersSent) {
            res.status(500).json({
              error: "Não foi possível baixar o backup.",
            });
          }
        }
      });
    } catch (error) {
      backupInProgress = false;
      if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
      logger.error({ err: error }, "Falha ao gerar backup administrativo");
      res.status(500).json({
        error:
          "Não foi possível gerar o backup. Verifique a configuração do servidor.",
      });
    }
  },
);

export default router;
