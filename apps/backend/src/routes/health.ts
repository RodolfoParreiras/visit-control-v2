import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@visit-control/api-zod";

const router: IRouter = Router();

// /api/health — usado pelo Docker healthcheck e pelo monitoramento
router.get("/health", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// /api/healthz — alias mantido para compatibilidade
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
