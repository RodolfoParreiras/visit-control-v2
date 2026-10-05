import { Router, type IRouter, type Request, type Response } from "express";
import { db, auditLogsTable, usersTable } from "@visit-control/db";
import { eq, and, gte, lte, sql, desc, type SQL } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { ListAuditLogsQueryParams } from "@visit-control/api-zod";
import { validate } from "../middlewares/validate";

const router: IRouter = Router();

router.get(
  "/audit",
  requireAuth,
  requirePermission("viewAudit"),
  validate("query", ListAuditLogsQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const {
      userId,
      action,
      dateFrom,
      dateTo,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions: SQL[] = [];
    if (userId)
      conditions.push(eq(auditLogsTable.userId, parseInt(userId, 10)));
    if (action) conditions.push(eq(auditLogsTable.action, action));
    if (dateFrom) {
      conditions.push(
        gte(auditLogsTable.createdAt, new Date(dateFrom + "T00:00:00Z")),
      );
    }
    if (dateTo) {
      conditions.push(
        lte(auditLogsTable.createdAt, new Date(dateTo + "T23:59:59Z")),
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogsTable)
      .where(whereClause);

    const rows = await db
      .select({
        id: auditLogsTable.id,
        action: auditLogsTable.action,
        userId: auditLogsTable.userId,
        ipAddress: auditLogsTable.ipAddress,
        entityType: auditLogsTable.entityType,
        entityId: auditLogsTable.entityId,
        previousData: auditLogsTable.previousData,
        newData: auditLogsTable.newData,
        createdAt: auditLogsTable.createdAt,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          login: usersTable.login,
          role: usersTable.role,
          status: usersTable.status,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
        },
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json({
      data: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        user: r.user
          ? {
              ...r.user,
              createdAt: r.user.createdAt.toISOString(),
              updatedAt: r.user.updatedAt?.toISOString() ?? null,
            }
          : null,
      })),
      total: count,
      page: pageNum,
      limit: limitNum,
    });
  },
);

export default router;
