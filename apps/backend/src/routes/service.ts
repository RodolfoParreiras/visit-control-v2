import { Router, type IRouter, type Request, type Response } from "express";
import { db, pool, sectorsTable, serviceDesksTable, usersTable, type PoolClient } from "@visit-control/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { auditAction } from "../lib/audit";
import { addServiceDisplayClient, publishServiceCall, publishServiceQueueUpdate } from "../lib/service-events";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };
type Sector = typeof sectorsTable.$inferSelect;
type QueueType = "priority" | "normal";
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
  // Usuários vinculados a um setor atendem somente nele; administradores sem
  // setor podem informar qual central desejam abrir.
  if (req.user.sectorId) return req.user.sectorId;
  if (req.user.role !== "admin") return null;
  const raw = req.query.sectorId ?? req.body?.sectorId;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function ensureCentralAccess(req: AuthReq, res: Response) {
  const sectorId = requestedSector(req);
  if (!sectorId) {
    res.status(400).json({ error: "O usuário precisa estar vinculado a um setor de atendimento" });
    return null;
  }
  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector || !sector.queueEnabled || sector.status !== "active") {
    res.status(400).json({ error: "A central de atendimento não está ativa para este setor" });
    return null;
  }
  return sector;
}

function parseQueueType(value: unknown): QueueType | null {
  return value === "priority" || value === "normal" ? value : null;
}

/** Valida a mesa escolhida; devolve null em setores de chamada geral. */
async function resolveDesk(sector: Sector, rawDeskId: unknown, res: Response): Promise<number | null | false> {
  if (!sector.usesDesks) return null;
  const deskId = rawDeskId != null ? Number(rawDeskId) : NaN;
  if (!Number.isInteger(deskId) || deskId <= 0) {
    res.status(400).json({ error: "Selecione uma mesa ativa" });
    return false;
  }
  const [desk] = await db.select().from(serviceDesksTable).where(and(
    eq(serviceDesksTable.id, deskId),
    eq(serviceDesksTable.sectorId, sector.id),
    eq(serviceDesksTable.active, true),
  ));
  if (!desk) {
    res.status(400).json({ error: "Mesa inválida ou inativa" });
    return false;
  }
  return deskId;
}

const queueFilters: Record<QueueType, string> = {
  priority: "AND priority_level > 0",
  normal: "AND priority_level = 0",
};

const emptyQueueMessages: Record<QueueType, string> = {
  priority: "Não há visitantes aguardando na fila prioritária",
  normal: "Não há visitantes aguardando na fila comum",
};

/** Chama o próximo da fila escolhida dentro da transação e devolve o id na fila. */
async function callNextInTransaction(
  client: PoolClient,
  sectorId: number,
  deskId: number | null,
  attendantUserId: number,
  queue: QueueType,
): Promise<number | null> {
  const next = await client.query(`
    SELECT id, visit_id AS "visitId" FROM service_queue
    WHERE sector_id = $1 AND status = 'waiting' ${queueFilters[queue]}
    ORDER BY priority_level DESC, queued_at, id
    LIMIT 1 FOR UPDATE SKIP LOCKED
  `, [sectorId]);
  if (!next.rowCount) return null;

  const queueId = Number(next.rows[0].id);
  await client.query(
    `UPDATE service_queue SET status='called', called_at=NOW(), desk_id=$2, attendant_user_id=$3 WHERE id=$1`,
    [queueId, deskId, attendantUserId],
  );
  // A visita passa de "aguardando" para "em andamento" ao ser chamada.
  await client.query(
    `UPDATE visits SET status='ongoing' WHERE id=$1 AND status='waiting'`,
    [next.rows[0].visitId],
  );
  await client.query(
    `INSERT INTO service_calls (queue_id, sector_id, desk_id, attendant_user_id) VALUES ($1,$2,$3,$4)`,
    [queueId, sectorId, deskId, attendantUserId],
  );
  return queueId;
}

/** Finaliza o atendimento atual e registra a saída; null se não encontrado. */
async function completeInTransaction(
  client: PoolClient,
  queueId: number,
  sectorId: number,
  attendantUserId: number,
): Promise<{ exitRegistered: boolean } | null> {
  const current = await client.query(`
    SELECT q.id, q.visit_id AS "visitId"
    FROM service_queue q
    JOIN visits v ON v.id = q.visit_id
    WHERE q.id = $1 AND q.sector_id = $2 AND q.status = 'called' AND q.attendant_user_id = $3
    FOR UPDATE OF q, v
  `, [queueId, sectorId, attendantUserId]);
  if (!current.rowCount) return null;

  await client.query(
    "UPDATE service_queue SET status='completed', completed_at=NOW() WHERE id=$1",
    [queueId],
  );
  const visitResult = await client.query(`
    UPDATE visits
    SET status='finished',
        exit_date=TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
        exit_time=TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
        exit_user_id=$2
    WHERE id=$1 AND status IN ('waiting', 'ongoing')
    RETURNING id
  `, [current.rows[0].visitId, attendantUserId]);
  return { exitRegistered: Boolean(visitResult.rowCount) };
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

class ServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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
  res.write(`retry: 3000\nevent: connected\ndata: {}\n\n`);
  (res as Response & { flush?: () => void }).flush?.();
  const remove = addServiceDisplayClient(res);
  // Evento (e não comentário SSE) para que o cliente perceba conexões mortas.
  const heartbeat = setInterval(() => { res.write(`event: ping\ndata: {}\n\n`); (res as Response & { flush?: () => void }).flush?.(); }, 20_000);
  req.on("close", () => { clearInterval(heartbeat); remove(); });
});

router.get("/service/central", requireAuth, requirePermission("accessServiceCenter"), async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const [desks, queue, current] = await Promise.all([
    pool.query(`SELECT id, name, active FROM service_desks WHERE sector_id = $1 ORDER BY name`, [sector.id]),
    pool.query(`
      SELECT q.id, q.queued_at AS "queuedAt", COALESCE(v.visitor_name, p.name) AS "visitorName",
        q.priority_level AS "priorityLevel", q.priority_reason AS "priorityReason"
      FROM service_queue q JOIN visits v ON v.id = q.visit_id LEFT JOIN visitors p ON p.id = v.visitor_id
      WHERE q.sector_id = $1 AND q.status = 'waiting' ORDER BY q.priority_level DESC, q.queued_at, q.id
    `, [sector.id]),
    pool.query(`
      SELECT q.id, q.called_at AS "calledAt", COALESCE(v.visitor_name, p.name) AS "visitorName",
        d.id AS "deskId", d.name AS "deskName",
        q.priority_level AS "priorityLevel", q.priority_reason AS "priorityReason"
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

router.post("/service/call-next", requireAuth, requirePermission("accessServiceCenter"), async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const input = (req.body ?? {}) as { deskId?: unknown; queue?: unknown };
  const queue = parseQueueType(input.queue);
  if (!queue) { res.status(400).json({ error: "Escolha a fila prioritária ou a fila comum" }); return; }
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const deskId = await resolveDesk(sector, input.deskId, res);
  if (deskId === false) return;

  let queueId: number;
  try {
    queueId = await inTransaction(async (client) => {
      const active = await client.query("SELECT id FROM service_queue WHERE attendant_user_id = $1 AND status = 'called' FOR UPDATE", [authReq.user.id]);
      if (active.rowCount) throw new ServiceError(409, "Finalize o atendimento atual antes de chamar o próximo");
      const called = await callNextInTransaction(client, sector.id, deskId, authReq.user.id, queue);
      if (!called) throw new ServiceError(404, emptyQueueMessages[queue]);
      return called;
    });
  } catch (error) {
    if (error instanceof ServiceError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }

  await auditAction({ userId: authReq.user.id, action: "call_next_visitor", ipAddress: req.ip, entityType: "service_queue", entityId: queueId, newData: { sectorId: sector.id, deskId, queue } });
  publishServiceCall();
  res.json({ success: true, queueId });
});

router.post("/service/queue/:id/recall", requireAuth, requirePermission("accessServiceCenter"), async (req: Request, res: Response): Promise<void> => {
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

router.post("/service/queue/:id/complete", requireAuth, requirePermission("accessServiceCenter"), async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const id = Number(req.params.id);
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;

  const result = await inTransaction((client) => completeInTransaction(client, id, sector.id, authReq.user.id));
  if (!result) {
    res.status(404).json({ error: "Atendimento atual não encontrado" });
    return;
  }

  publishServiceQueueUpdate();
  await auditAction({
    userId: authReq.user.id,
    action: "complete_service",
    ipAddress: req.ip,
    entityType: "service_queue",
    entityId: id,
    newData: { sectorId: sector.id, exitRegistered: result.exitRegistered },
  });
  res.json({ success: true, exitRegistered: result.exitRegistered });
});

router.post("/service/queue/:id/complete-and-call-next", requireAuth, requirePermission("accessServiceCenter"), async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthReq;
  const id = Number(req.params.id);
  const input = (req.body ?? {}) as { deskId?: unknown; queue?: unknown };
  const queue = parseQueueType(input.queue);
  if (!queue) { res.status(400).json({ error: "Escolha a fila prioritária ou a fila comum" }); return; }
  const sector = await ensureCentralAccess(authReq, res);
  if (!sector) return;
  const deskId = await resolveDesk(sector, input.deskId, res);
  if (deskId === false) return;

  const result = await inTransaction(async (client) => {
    const completed = await completeInTransaction(client, id, sector.id, authReq.user.id);
    if (!completed) return null;
    const nextQueueId = await callNextInTransaction(client, sector.id, deskId, authReq.user.id, queue);
    return { ...completed, nextQueueId };
  });
  if (!result) {
    res.status(404).json({ error: "Atendimento atual não encontrado" });
    return;
  }

  if (result.nextQueueId) publishServiceCall();
  else publishServiceQueueUpdate();

  await auditAction({
    userId: authReq.user.id,
    action: "complete_service_and_call_next",
    ipAddress: req.ip,
    entityType: "service_queue",
    entityId: id,
    newData: { sectorId: sector.id, deskId, queue, exitRegistered: result.exitRegistered, nextQueueId: result.nextQueueId },
  });

  res.json({
    success: true,
    exitRegistered: result.exitRegistered,
    calledNext: Boolean(result.nextQueueId),
    queueId: result.nextQueueId,
  });
});

router.get("/sectors/:id/desks", requireAuth, requirePermission("manageSectors"), async (req, res) => {
  const desks = await db.select().from(serviceDesksTable).where(eq(serviceDesksTable.sectorId, Number(req.params.id))).orderBy(serviceDesksTable.name);
  res.json(desks.map((desk) => ({ ...desk, createdAt: desk.createdAt.toISOString() })));
});

router.post("/sectors/:id/desks", requireAuth, requirePermission("manageSectors"), async (req, res): Promise<void> => {
  const data = deskData(req.body);
  if (!data?.name) { res.status(400).json({ error: "Nome da mesa é obrigatório" }); return; }
  const [desk] = await db.insert(serviceDesksTable).values({ sectorId: Number(req.params.id), name: data.name, active: data.active }).returning();
  res.status(201).json({ ...desk, createdAt: desk.createdAt.toISOString() });
});

router.patch("/sectors/:sectorId/desks/:id", requireAuth, requirePermission("manageSectors"), async (req, res): Promise<void> => {
  const data = deskData(req.body, true);
  if (!data) { res.status(400).json({ error: "Dados da mesa inválidos" }); return; }
  const [desk] = await db.update(serviceDesksTable).set(data).where(and(eq(serviceDesksTable.id, Number(req.params.id)), eq(serviceDesksTable.sectorId, Number(req.params.sectorId)))).returning();
  if (!desk) { res.status(404).json({ error: "Mesa não encontrada" }); return; }
  res.json({ ...desk, createdAt: desk.createdAt.toISOString() });
});

router.delete("/sectors/:sectorId/desks/:id", requireAuth, requirePermission("manageSectors"), async (req, res): Promise<void> => {
  const [desk] = await db.delete(serviceDesksTable).where(and(eq(serviceDesksTable.id, Number(req.params.id)), eq(serviceDesksTable.sectorId, Number(req.params.sectorId)))).returning();
  if (!desk) { res.status(404).json({ error: "Mesa não encontrada" }); return; }
  res.json({ success: true });
});

export default router;
