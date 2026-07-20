import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fieldConfigTable = pgTable("field_config", {
  id: serial("id").primaryKey(),
  cpf: text("cpf", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  phone: text("phone", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  company: text("company", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  city: text("city", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  responsible: text("responsible", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  reason: text("reason", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  notes: text("notes", { enum: ["hidden", "optional", "required"] })
    .notNull()
    .default("optional"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFieldConfigSchema = createInsertSchema(fieldConfigTable).omit(
  { id: true, updatedAt: true },
);
export type InsertFieldConfig = z.infer<typeof insertFieldConfigSchema>;
export type FieldConfig = typeof fieldConfigTable.$inferSelect;
