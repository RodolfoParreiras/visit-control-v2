import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
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
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Origem não permitida por CORS"));
    },
    credentials: true,
  }),
);

// ── Compressão HTTP ────────────────────────────────────────────────────────
app.use(compression());

// ── Rate limiting (global) ─────────────────────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
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

export default app;
