import { Router, type IRouter, type Request, type Response } from "express";
import { db, pool, sectorsTable, serviceDesksTable, usersTable } from "@visit-control/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import { addServiceDisplayClient, publishServiceCall, publishServiceQueueUpdate } from "../lib/service-events";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };
const router: IRouter = Router();

function deskData(body: unknown, partial = false): { name?: string; active?: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const data: { name?: string; active?: boolean } = {};
  if (typeof input.name === "string" && input.name.trim() && input.name.trim().length <= 80) data.name = input.name.trim();
  else if (!partial) return null;
  if (typeof input.active === "boolean") data.active = input.active;
  if (partial && data.name === undefined && data.active === undefined) return null;
  return data;
}

function requestedSector(req: AuthReq): number | null {
  if (req.user.role === "attendant") return req.user.sectorId;
  const raw = req.query.sectorId ?? req.body?.sectorId;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function ensureCentralAccess(req: AuthReq, res: Response) {
  if (req.user.role === "receptionist") {
    res.status(403).json({ error: "Acesso restrito à Central de Atendimento" });
    return null;
  }
  const sectorId = requestedSector(req);
  if (!sectorId) {
    res.status(400).json({ error: "O atendente precisa estar vinculado a um setor" });
    return null;
  }
  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector || !sector.queueEnabled || sector.status !== "active") {
    res.status(400).json({ error: "A central de atendimento não está ativa para este setor" });
    return null;
  }
  return sector;
}

async function displayData() {
  const result = await pool.query(`
    SELECT c.id, c.called_at AS "calledAt", q.id AS "queueId",
      COALESCE(vs.visitor_name, vr.name) AS "visitorName",
      s.id AS "sectorId", s.name AS "sectorName",
      d.id AS "deskId", d.name AS "deskName"
    FROM service_calls c
    JOIN service_queue q ON q.id = c.queue_id
    JOIN visits vs ON vs.id = q.visit_id
    LEFT JOIN visitors vr ON vr.id = vs.visitor_id
    JOIN sectors s ON s.id = c.sector_id
    LEFT JOIN service_desks d ON d.id = c.desk_id
    ORDER BY c.called_at DESC, c.id DESC
    LIMIT 6
  `);
  return { current: result.rows[0] ?? null, recent: result.rows.slice(1) };
}

router.get("/service/display", async (_req, res) => res.json(await displayData()));

router.get("/service/display/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(`event: connected\ndata: {}\n\n`);
  (res as Response & { flush?: () => void }).flush?.();
  const remove = addServiceDisplayClient(res);
  const heartbeat = setInterval(() => { res.write(`: heartbeat\n\n`); (res as Response & { flush?: () => void }).flush?.(); }, 20_000);
  req.on("close", () => { clearInterval(heartbeat); remove(); });
});

router.get("/service/central", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const [desks, queue, current] = await Promise.all([
    pool.query(`SELECT id, name, active FROM service_desks WHERE sector_id = $1 ORDER BY name`, [sector.id]),
    pool.query(`
      SELECT q.id, q.queued_at AS "queuedAt", COALESCE(v.visitor_name, p.name) AS "visitorName"
      FROM service_queue q JOIN visits v ON v.id = q.visit_id LEFT JOIN visitors p ON p.id = v.visitor_id
      WHERE q.sector_id = $1 AND q.status = 'waiting' ORDER BY q.queued_at, q.id
    `, [sector.id]),
    pool.query(`
      SELECT q.id, q.called_at AS "calledAt", COALESCE(v.visitor_name, p.name) AS "visitorName",
        d.id AS "deskId", d.name AS "deskName"
      FROM service_queue q JOIN visits v ON v.id = q.visit_id LEFT JOIN visitors p ON p.id = v.visitor_id
      LEFT JOIN service_desks d ON d.id = q.desk_id
      WHERE q.sector_id = $1 AND q.status = 'called' AND q.attendant_user_id = $2
      ORDER BY q.called_at DESC LIMIT 1
    `, [sector.id, authReq.user.id]),
  ]);
  res.json({
    sector: { id: sector.id, name: sector.name, usesDesks: sector.usesDesks },
    desks: desks.rows,
    queue: queue.rows,
    current: current.rows[0] ?? null,
  });
});

router.post("/service/call-next", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const input = (req.body ?? {}) as { sectorId?: unknown; deskId?: unknown };
  if (input.deskId !== undefined && input.deskId !== null && (!Number.isInteger(Number(input.deskId)) || Number(input.deskId) <= 0)) { res.status(400).json({ error: "Dados da chamada inválidos" }); return; }
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const deskId = sector.usesDesks && input.deskId != null ? Number(input.deskId) : null;
  if (sector.usesDesks) {
    if (!deskId) { res.status(400).json({ error: "Selecione uma mesa ativa" }); return; }
    const [desk] = await db.select().from(serviceDesksTable).where(and(eq(serviceDesksTable.id, deskId), eq(serviceDesksTable.sectorId, sector.id), eq(serviceDesksTable.active, true)));
    if (!desk) { res.status(400).json({ error: "Mesa inválida ou inativa" }); return; }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const active = await client.query("SELECT id FROM service_queue WHERE attendant_user_id = $1 AND status = 'called' FOR UPDATE", [authReq.user.id]);
    if (active.rowCount) { await client.query("ROLLBACK"); res.status(409).json({ error: "Finalize o atendimento atual antes de chamar o próximo" }); return; }
    const next = await client.query(`
      SELECT id FROM service_queue WHERE sector_id = $1 AND status = 'waiting'
      ORDER BY queued_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
    `, [sector.id]);
    if (!next.rowCount) { await client.query("ROLLBACK"); res.status(404).json({ error: "Não há visitantes aguardando neste setor" }); return; }
    const queueId = next.rows[0].id;
    await client.query(`UPDATE service_queue SET status='called', called_at=NOW(), desk_id=$2, attendant_user_id=$3 WHERE id=$1`, [queueId, deskId, authReq.user.id]);
    await client.query(`INSERT INTO service_calls (queue_id, sector_id, desk_id, attendant_user_id) VALUES ($1,$2,$3,$4)`, [queueId, sector.id, deskId, authReq.user.id]);
    await client.query("COMMIT");
    await auditAction({ userId: authReq.user.id, action: "call_next_visitor", ipAddress: req.ip, entityType: "service_queue", entityId: queueId, newData: { sectorId: sector.id, deskId } });
    publishServiceCall();
    res.json({ success: true, queueId });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});

router.post("/service/queue/:id/recall", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const id = Number(req.params.id);
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const result = await pool.query(`
    INSERT INTO service_calls (queue_id, sector_id, desk_id, attendant_user_id)
    SELECT id, sector_id, desk_id, $2 FROM service_queue
    WHERE id=$1 AND sector_id=$3 AND status='called' AND attendant_user_id=$2 RETURNING id
  `, [id, authReq.user.id, sector.id]);
  if (!result.rowCount) { res.status(404).json({ error: "Atendimento atual não encontrado" }); return; }
  await pool.query("UPDATE service_queue SET called_at=NOW() WHERE id=$1", [id]);
  publishServiceCall();
  res.json({ success: true });
});

router.post("/service/queue/:id/complete", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const id = Number(req.params.id);
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const result = await pool.query(`UPDATE service_queue SET status='completed', completed_at=NOW() WHERE id=$1 AND sector_id=$2 AND status='called' AND attendant_user_id=$3 RETURNING id`, [id, sector.id, authReq.user.id]);
  if (!result.rowCount) { res.status(404).json({ error: "Atendimento atual não encontrado" }); return; }
  publishServiceQueueUpdate();
  res.json({ success: true });
});

router.post("/service/queue/:id/complete-and-call-next", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const id = Number(req.params.id);
  const input = (req.body ?? {}) as { sectorId?: unknown; deskId?: unknown };
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;

  const deskId = sector.usesDesks && input.deskId != null ? Number(input.deskId) : null;
  if (sector.usesDesks) {
    if (!Number.isInteger(deskId) || !deskId || deskId <= 0) {
      res.status(400).json({ error: "Selecione uma mesa ativa" });
      return;
    }
    const [desk] = await db.select().from(serviceDesksTable).where(and(
      eq(serviceDesksTable.id, deskId),
      eq(serviceDesksTable.sectorId, sector.id),
      eq(serviceDesksTable.active, true),
    ));
    if (!desk) {
      res.status(400).json({ error: "Mesa inválida ou inativa" });
      return;
    }
  }

  const client = await pool.connect();
  let nextQueueId: number | null = null;
  let exitRegistered = false;
  try {
    await client.query("BEGIN");
    const current = await client.query(`
      SELECT q.id, q.visit_id AS "visitId"
      FROM service_queue q
      JOIN visits v ON v.id = q.visit_id
      WHERE q.id = $1 AND q.sector_id = $2 AND q.status = 'called' AND q.attendant_user_id = $3
      FOR UPDATE OF q, v
    `, [id, sector.id, authReq.user.id]);

    if (!current.rowCount) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Atendimento atual não encontrado" });
      return;
    }

    const visitId = Number(current.rows[0].visitId);
    await client.query(
      "UPDATE service_queue SET status='completed', completed_at=NOW() WHERE id=$1",
      [id],
    );
    const visitResult = await client.query(`
      UPDATE visits
      SET status='finished',
          exit_date=TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
          exit_time=TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
          exit_user_id=$2
      WHERE id=$1 AND status='ongoing'
      RETURNING id
    `, [visitId, authReq.user.id]);
    exitRegistered = Boolean(visitResult.rowCount);

    const next = await client.query(`
      SELECT id FROM service_queue
      WHERE sector_id = $1 AND status = 'waiting'
      ORDER BY queued_at, id
      LIMIT 1 FOR UPDATE SKIP LOCKED
    `, [sector.id]);

    if (next.rowCount) {
      nextQueueId = Number(next.rows[0].id);
      await client.query(`
        UPDATE service_queue
        SET status='called', called_at=NOW(), desk_id=$2, attendant_user_id=$3
        WHERE id=$1
      `, [nextQueueId, deskId, authReq.user.id]);
      await client.query(`
        INSERT INTO service_calls (queue_id, sector_id, desk_id, attendant_user_id)
        VALUES ($1, $2, $3, $4)
      `, [nextQueueId, sector.id, deskId, authReq.user.id]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (nextQueueId) publishServiceCall();
  else publishServiceQueueUpdate();

  await auditAction({
    userId: authReq.user.id,
    action: "complete_service_and_call_next",
    ipAddress: req.ip,
    entityType: "service_queue",
    entityId: id,
    newData: { sectorId: sector.id, deskId, exitRegistered, nextQueueId },
  });

  res.json({ success: true, exitRegistered, calledNext: Boolean(nextQueueId), queueId: nextQueueId });
});

router.get("/sectors/:id/desks", requireAuth, requireAdmin, async (req, res) => {
  const desks = await db.select().from(serviceDesksTable).where(eq(serviceDesksTable.sectorId, Number(req.params.id))).orderBy(serviceDesksTable.name);
  res.json(desks.map((desk) => ({ ...desk, createdAt: desk.createdAt.toISOString() })));
});

router.post("/sectors/:id/desks", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const data = deskData(req.body);
  if (!data?.name) { res.status(400).json({ error: "Nome da mesa é obrigatório" }); return; }
  const [desk] = await db.insert(serviceDesksTable).values({ sectorId: Number(req.params.id), name: data.name, active: data.active }).returning();
  res.status(201).json({ ...desk, createdAt: desk.createdAt.toISOString() });
});

router.patch("/sectors/:sectorId/desks/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const data = deskData(req.body, true);
  if (!data) { res.status(400).json({ error: "Dados da mesa inválidos" }); return; }
  const [desk] = await db.update(serviceDesksTable).set(data).where(and(eq(serviceDesksTable.id, Number(req.params.id)), eq(serviceDesksTable.sectorId, Number(req.params.sectorId)))).returning();
  if (!desk) { res.status(404).json({ error: "Mesa não encontrada" }); return; }
  res.json({ ...desk, createdAt: desk.createdAt.toISOString() });
});

router.delete("/sectors/:sectorId/desks/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const [desk] = await db.delete(serviceDesksTable).where(and(eq(serviceDesksTable.id, Number(req.params.id)), eq(serviceDesksTable.sectorId, Number(req.params.sectorId)))).returning();
  if (!desk) { res.status(404).json({ error: "Mesa não encontrada" }); return; }
  res.json({ success: true });
});

export default router;
