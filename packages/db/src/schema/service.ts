import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sectorsTable } from "./sectors";
import { usersTable } from "./users";
import { visitsTable } from "./visits";

export const serviceDesksTable = pgTable("service_desks", {
  id: serial("id").primaryKey(),
  sectorId: integer("sector_id").notNull().references(() => sectorsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceQueueTable = pgTable("service_queue", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => visitsTable.id, { onDelete: "cascade" }),
  sectorId: integer("sector_id").notNull().references(() => sectorsTable.id),
  status: text("status", { enum: ["waiting", "called", "completed", "cancelled"] }).notNull().default("waiting"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  calledAt: timestamp("called_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deskId: integer("desk_id").references(() => serviceDesksTable.id),
  attendantUserId: integer("attendant_user_id").references(() => usersTable.id),
}, (table) => [uniqueIndex("service_queue_visit_unique").on(table.visitId)]);

export const serviceCallsTable = pgTable("service_calls", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").notNull().references(() => serviceQueueTable.id, { onDelete: "cascade" }),
  sectorId: integer("sector_id").notNull().references(() => sectorsTable.id),
  deskId: integer("desk_id").references(() => serviceDesksTable.id),
  attendantUserId: integer("attendant_user_id").notNull().references(() => usersTable.id),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
});
