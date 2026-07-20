import { pgTable, serial, text, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const labelConfigTable = pgTable("label_config", {
  id: serial("id").primaryKey(),
  municipalityName: text("municipality_name")
    .notNull()
    .default("Prefeitura Municipal de Paraíba do Sul"),
  title: text("title").notNull().default("Identificação de Visitante"),
  logoUrl: text("logo_url"),
  showLogo: boolean("show_logo").notNull().default(false),
  showQrCode: boolean("show_qr_code").notNull().default(true),
  showName: boolean("show_name").notNull().default(true),
  showSector: boolean("show_sector").notNull().default(true),
  showDate: boolean("show_date").notNull().default(true),
  showTime: boolean("show_time").notNull().default(true),
  showVisitNumber: boolean("show_visit_number").notNull().default(true),
  labelWidth: real("label_width").notNull().default(100),
  labelHeight: real("label_height").notNull().default(60),
  marginTop: real("margin_top").notNull().default(3),
  marginRight: real("margin_right").notNull().default(3),
  marginBottom: real("margin_bottom").notNull().default(3),
  marginLeft: real("margin_left").notNull().default(3),
  fontSize: real("font_size").notNull().default(12),
  fontFamily: text("font_family").notNull().default("Arial"),
  printerModel: text("printer_model").notNull().default("custom"),
  elementsLayout: text("elements_layout"), // JSON string com posições x/y de cada elemento
  headerText: text("header_text"),
  footerText: text("footer_text"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLabelConfigSchema = createInsertSchema(labelConfigTable).omit(
  { id: true, updatedAt: true },
);
export type InsertLabelConfig = z.infer<typeof insertLabelConfigSchema>;
export type LabelConfig = typeof labelConfigTable.$inferSelect;
