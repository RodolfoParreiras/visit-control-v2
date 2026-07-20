import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visitorsTable = pgTable(
  "visitors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    cpf: text("cpf").notNull(),
    phone: text("phone"),
    company: text("company"),
    city: text("city"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("visitors_cpf_unique").on(t.cpf),
  ],
);

export const insertVisitorSchema = createInsertSchema(visitorsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitorsTable.$inferSelect;
