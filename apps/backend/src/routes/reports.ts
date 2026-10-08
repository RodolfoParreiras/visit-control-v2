import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  visitsTable,
  visitorsTable,
  sectorsTable,
} from "@visit-control/db";
import { eq, and, gte, lte, sql, desc, type SQL } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { sectorScope } from "../lib/permissions";
import { GetVisitsReportQueryParams } from "@visit-control/api-zod";
import { validate } from "../middlewares/validate";
import { resolveVisitorSnapshot } from "../lib/visitor-snapshot";

const router: IRouter = Router();

router.get(
  "/reports/visits",
  requireAuth,
  requirePermission("viewReports"),
  validate("query", GetVisitsReportQueryParams),
  async (req: Request, res: Response): Promise<void> => {
    const { dateFrom, dateTo, sectorId, userId, status } = req.query as Record<
      string,
      string | undefined
    >;

    const conditions: SQL[] = [];
    const scope = sectorScope((req as Request & { user: Parameters<typeof sectorScope>[0] }).user);
    if (scope) conditions.push(eq(visitsTable.sectorId, scope));
    if (dateFrom) conditions.push(gte(visitsTable.entryDate, dateFrom));
    if (dateTo) conditions.push(lte(visitsTable.entryDate, dateTo));
    if (sectorId)
      conditions.push(eq(visitsTable.sectorId, parseInt(sectorId, 10)));
    if (userId)
      conditions.push(eq(visitsTable.entryUserId, parseInt(userId, 10)));
    if (status && ["waiting", "ongoing", "finished", "cancelled"].includes(status)) {
      conditions.push(
        eq(visitsTable.status, status as "waiting" | "ongoing" | "finished" | "cancelled"),
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(whereClause);

    const rows = await db
      .select({
        id: visitsTable.id,
        visitorId: visitsTable.visitorId,
        sectorId: visitsTable.sectorId,
        responsible: visitsTable.responsible,
        reason: visitsTable.reason,
        notes: visitsTable.notes,
        status: visitsTable.status,
        entryDate: visitsTable.entryDate,
        entryTime: visitsTable.entryTime,
        entryUserId: visitsTable.entryUserId,
        exitDate: visitsTable.exitDate,
        exitTime: visitsTable.exitTime,
        exitUserId: visitsTable.exitUserId,
        cancelReason: visitsTable.cancelReason,
        createdAt: visitsTable.createdAt,
        visitorSnapshot: {
          name: visitsTable.visitorName,
          cpf: visitsTable.visitorCpf,
          phone: visitsTable.visitorPhone,
          company: visitsTable.visitorCompany,
          city: visitsTable.visitorCity,
        },
        visitor: {
          id: visitorsTable.id,
          name: visitorsTable.name,
          cpf: visitorsTable.cpf,
          phone: visitorsTable.phone,
          company: visitorsTable.company,
          city: visitorsTable.city,
          createdAt: visitorsTable.createdAt,
          updatedAt: visitorsTable.updatedAt,
        },
        sector: {
          id: sectorsTable.id,
          name: sectorsTable.name,
          abbreviation: sectorsTable.abbreviation,
          secretariat: sectorsTable.secretariat,
          status: sectorsTable.status,
          createdAt: sectorsTable.createdAt,
        },
      })
      .from(visitsTable)
      .leftJoin(visitorsTable, eq(visitsTable.visitorId, visitorsTable.id))
      .leftJoin(sectorsTable, eq(visitsTable.sectorId, sectorsTable.id))
      .where(whereClause)
      .orderBy(desc(visitsTable.entryDate), desc(visitsTable.entryTime))
      .limit(1000);

    res.json({
      visits: rows.map((r) => {
        const { visitorSnapshot, ...visit } = r;
        return {
          ...visit,
          createdAt: r.createdAt.toISOString(),
          visitor: r.visitor
            ? {
                ...resolveVisitorSnapshot(r.visitor, visitorSnapshot),
                createdAt: r.visitor.createdAt.toISOString(),
                updatedAt: r.visitor.updatedAt?.toISOString() ?? null,
              }
            : null,
          sector: r.sector
            ? { ...r.sector, createdAt: r.sector.createdAt.toISOString() }
            : null,
        };
      }),
      total: count,
      filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null },
    });
  },
);

export default router;
