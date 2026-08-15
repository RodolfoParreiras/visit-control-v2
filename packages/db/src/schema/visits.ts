import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { visitorsTable } from "./visitors";
import { sectorsTable } from "./sectors";

export const visitsTable = pgTable(
  "visits",
  {
    id: serial("id").primaryKey(),
    visitorId: integer("visitor_id")
      .notNull()
      .references(() => visitorsTable.id),
    sectorId: integer("sector_id")
      .notNull()
      .references(() => sectorsTable.id),
    responsible: text("responsible"),
    reason: text("reason"),
    notes: text("notes"),
    status: text("status", {
      enum: ["ongoing", "finished", "cancelled"],
    })
      .notNull()
      .default("ongoing"),
    entryDate: text("entry_date").notNull(),
    entryTime: text("entry_time").notNull(),
    entryUserId: integer("entry_user_id")
      .notNull()
      .references(() => usersTable.id),
    exitDate: text("exit_date"),
    exitTime: text("exit_time"),
    exitUserId: integer("exit_user_id").references(() => usersTable.id),
    cancelReason: text("cancel_reason"),
    // Snapshot of visitor data at the moment the visit was registered.
    // These are immutable — they never change even if the visitor profile is later edited.
    visitorName: text("visitor_name"),
    visitorCpf: text("visitor_cpf").notNull(),
    visitorPhone: text("visitor_phone"),
    visitorCompany: text("visitor_company"),
    visitorCity: text("visitor_city"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("visits_one_ongoing_per_visitor")
      .on(table.visitorId)
      .where(sql`${table.status} = 'ongoing'`),
  ],
);

export const visitsRelations = relations(visitsTable, ({ one }) => ({
  visitor: one(visitorsTable, {
    fields: [visitsTable.visitorId],
    references: [visitorsTable.id],
  }),
  sector: one(sectorsTable, {
    fields: [visitsTable.sectorId],
    references: [sectorsTable.id],
  }),
  entryUser: one(usersTable, {
    fields: [visitsTable.entryUserId],
    references: [usersTable.id],
    relationName: "entryUser",
  }),
  exitUser: one(usersTable, {
    fields: [visitsTable.exitUserId],
    references: [usersTable.id],
    relationName: "exitUser",
  }),
}));

export const insertVisitSchema = createInsertSchema(visitsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visitsTable.$inferSelect;
