import { Router, type IRouter, type Request, type Response } from "express";
import { db, fieldConfigTable, labelConfigTable, usersTable } from "@visit-control/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { auditAction } from "../lib/audit";

type AuthReq = Request & { user: typeof usersTable.$inferSelect };

const router: IRouter = Router();

// ── Field Config ─────────────────────────────────────────────────────────────

router.get(
  "/config/fields",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db.select().from(fieldConfigTable).limit(1);
    if (rows.length === 0) {
      res.json({
        cpf: "optional",
        phone: "optional",
        company: "optional",
        city: "optional",
        responsible: "optional",
        reason: "optional",
        notes: "optional",
      });
      return;
    }
    const { id: _id, updatedAt: _ua, ...config } = rows[0];
    res.json(config);
  },
);

router.put(
  "/config/fields",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { cpf, phone, company, city, responsible, reason, notes } =
      req.body ?? {};

    const validValues = ["hidden", "optional", "required"];
    const toSet = {
      cpf: validValues.includes(cpf) ? cpf : "optional",
      phone: validValues.includes(phone) ? phone : "optional",
      company: validValues.includes(company) ? company : "optional",
      city: validValues.includes(city) ? city : "optional",
      responsible: validValues.includes(responsible) ? responsible : "optional",
      reason: validValues.includes(reason) ? reason : "optional",
      notes: validValues.includes(notes) ? notes : "optional",
      updatedAt: new Date(),
    };

    const existing = await db.select().from(fieldConfigTable).limit(1);
    let result;
    if (existing.length === 0) {
      [result] = await db.insert(fieldConfigTable).values(toSet).returning();
    } else {
      [result] = await db
        .update(fieldConfigTable)
        .set(toSet)
        .returning();
    }

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "update_field_config",
      ipAddress: req.ip,
      newData: toSet,
    });

    const { id: _id, updatedAt: _ua, ...config } = result;
    res.json(config);
  },
);

// ── Label Config ─────────────────────────────────────────────────────────────

const DEFAULT_LABEL_CONFIG = {
  municipalityName: "Prefeitura Municipal de Paraíba do Sul",
  title: "Identificação de Visitante",
  logoUrl: null,
  showLogo: false,
  showQrCode: true,
  showName: true,
  showSector: true,
  showDate: true,
  showTime: true,
  showVisitNumber: true,
  labelWidth: 100,
  labelHeight: 60,
  marginTop: 3,
  marginRight: 3,
  marginBottom: 3,
  marginLeft: 3,
  fontSize: 12,
  fontFamily: "Arial",
  printerModel: "custom",
  elementsLayout: null,
  headerText: null,
  footerText: null,
};

router.get(
  "/config/label",
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db.select().from(labelConfigTable).limit(1);
    if (rows.length === 0) {
      res.json(DEFAULT_LABEL_CONFIG);
      return;
    }
    const { id: _id, updatedAt: _ua, ...config } = rows[0];
    res.json(config);
  },
);

router.put(
  "/config/label",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};

    const toSet = {
      municipalityName: body.municipalityName
        ? String(body.municipalityName)
        : DEFAULT_LABEL_CONFIG.municipalityName,
      title: body.title ? String(body.title) : DEFAULT_LABEL_CONFIG.title,
      logoUrl: body.logoUrl ? String(body.logoUrl) : null,
      showLogo: Boolean(body.showLogo),
      showQrCode: body.showQrCode !== false,
      showName: body.showName !== false,
      showSector: body.showSector !== false,
      showDate: body.showDate !== false,
      showTime: body.showTime !== false,
      showVisitNumber: body.showVisitNumber !== false,
      labelWidth: Number(body.labelWidth) || DEFAULT_LABEL_CONFIG.labelWidth,
      labelHeight: Number(body.labelHeight) || DEFAULT_LABEL_CONFIG.labelHeight,
      marginTop: Number(body.marginTop) ?? DEFAULT_LABEL_CONFIG.marginTop,
      marginRight: Number(body.marginRight) ?? DEFAULT_LABEL_CONFIG.marginRight,
      marginBottom: Number(body.marginBottom) ?? DEFAULT_LABEL_CONFIG.marginBottom,
      marginLeft: Number(body.marginLeft) ?? DEFAULT_LABEL_CONFIG.marginLeft,
      fontSize: Number(body.fontSize) || DEFAULT_LABEL_CONFIG.fontSize,
      fontFamily: body.fontFamily ? String(body.fontFamily) : DEFAULT_LABEL_CONFIG.fontFamily,
      printerModel: body.printerModel ? String(body.printerModel) : DEFAULT_LABEL_CONFIG.printerModel,
      elementsLayout: body.elementsLayout ? String(body.elementsLayout) : null,
      headerText: body.headerText ? String(body.headerText) : null,
      footerText: body.footerText ? String(body.footerText) : null,
      updatedAt: new Date(),
    };

    const existing = await db.select().from(labelConfigTable).limit(1);
    let result;
    if (existing.length === 0) {
      [result] = await db.insert(labelConfigTable).values(toSet).returning();
    } else {
      [result] = await db
        .update(labelConfigTable)
        .set(toSet)
        .returning();
    }

    await auditAction({
      userId: (req as AuthReq).user.id,
      action: "update_label_config",
      ipAddress: req.ip,
      newData: { ...toSet, logoUrl: toSet.logoUrl ? "[base64_omitido]" : null },
    });

    const { id: _id, updatedAt: _ua, ...config } = result;
    res.json(config);
  },
);

export default router;
