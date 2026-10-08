import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { verifyToken } from "./lib/jwt";

const app: Express = express();
// DESABILITA ETag para APIs autenticadas
app.set('etag', false);

// ── Trust proxy (necessário atrás do Nginx) ────────────────────────────────
app.set("trust proxy", 1);

// ── Segurança: headers HTTP ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (server-to-server, curl, mobile)
      if (!origin) return callback(null, true);
      // Em desenvolvimento, permite localhost
      if (process.env.NODE_ENV !== "production" && origin.includes("localhost")) {
        return callback(null, true);
      }
      // Verifica lista explícita de origens permitidas
      if (allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      const error = new Error("Origem não permitida por CORS") as Error & { status?: number };
      error.status = 403;
      callback(error);
    },
    credentials: true,
  }),
);

// ── Compressão HTTP ────────────────────────────────────────────────────────
app.use(compression());

// ── Rate limiting (global) ─────────────────────────────────────────────────
// O limite é contado por usuário autenticado. Contar por IP fazia todos os
// computadores dividirem o mesmo limite quando o servidor não enxerga o IP real
// do cliente (ex.: Docker Desktop, onde todos chegam como o gateway do Docker).
function rateLimitKey(req: Request): string {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      return `user:${verifyToken(header.slice(7)).id}`;
    } catch {
      // Token inválido: cai no limite por IP.
    }
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1500,
  keyGenerator: rateLimitKey,
  skip: (req) =>
    req.path === "/api/health" ||
    req.path === "/api/healthz" ||
    req.path === "/api/service/display/events",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
});
app.use(globalLimiter);

// ── Logging HTTP ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Body parsers ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/api", router);

app.use(
  (error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    if (status === 500) logger.error({ err: error }, "Erro não tratado na API");
    res.status(status).json({
      error: status === 500 ? "Erro interno do servidor" : error.message,
    });
  },
);

export default app;
