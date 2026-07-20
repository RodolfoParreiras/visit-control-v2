import { Router, type IRouter, type Request, type Response } from "express";
import { db, visitsTable, visitorsTable, sectorsTable } from "@visit-control/db";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function today() {
  return new Date().toISOString().split("T")[0];
}

router.get(
  "/dashboard/stats",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const todayStr = today();

    const [todayTotal] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(eq(visitsTable.entryDate, todayStr));

    const [currentlyPresent] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(eq(visitsTable.status, "ongoing"));

    const [todayExits] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(
        and(
          eq(visitsTable.exitDate, todayStr),
          eq(visitsTable.status, "finished"),
        ),
      );

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStr = weekStart.toISOString().split("T")[0];

    const [weekTotal] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(gte(visitsTable.entryDate, weekStr));

    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 29);
    const monthStr = monthStart.toISOString().split("T")[0];

    const [monthTotal] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(gte(visitsTable.entryDate, monthStr));

    res.json({
      todayTotal: todayTotal.count,
      currentlyPresent: currentlyPresent.count,
      todayExits: todayExits.count,
      weekTotal: weekTotal.count,
      monthTotal: monthTotal.count,
    });
  },
);

router.get(
  "/dashboard/visits-by-sector",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const todayStr = today();
    const rows = await db
      .select({
        sectorId: visitsTable.sectorId,
        sectorName: sectorsTable.name,
        count: sql<number>`count(*)::int`,
      })
      .from(visitsTable)
      .leftJoin(sectorsTable, eq(visitsTable.sectorId, sectorsTable.id))
      .where(eq(visitsTable.entryDate, todayStr))
      .groupBy(visitsTable.sectorId, sectorsTable.name)
      .orderBy(sql`count(*) desc`);

    res.json(
      rows.map((r) => ({
        sectorId: r.sectorId,
        sectorName: r.sectorName ?? "Desconhecido",
        count: r.count,
      })),
    );
  },
);

router.get(
  "/dashboard/weekly-chart",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const points = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
      });
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitsTable)
        .where(eq(visitsTable.entryDate, dateStr));
      points.push({ label, total: count });
    }
    res.json(points);
  },
);

router.get(
  "/dashboard/monthly-chart",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const points = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitsTable)
        .where(eq(visitsTable.entryDate, dateStr));
      points.push({ label, total: count });
    }
    res.json(points);
  },
);

router.get(
  "/dashboard/recent-visits",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(
      50,
      parseInt((req.query.limit as string) ?? "10", 10),
    );

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
      .orderBy(desc(visitsTable.createdAt))
      .limit(limit);

    res.json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        visitor: r.visitor
          ? {
              ...r.visitor,
              createdAt: r.visitor.createdAt.toISOString(),
              updatedAt: r.visitor.updatedAt?.toISOString() ?? null,
            }
          : null,
        sector: r.sector
          ? { ...r.sector, createdAt: r.sector.createdAt.toISOString() }
          : null,
      })),
    );
  },
);

export default router;
