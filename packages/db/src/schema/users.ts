import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sectorsTable } from "./sectors";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type UserPermissions = {
  editVisitorName: boolean;
  editVisitorCpf: boolean;
  editVisitorPhone: boolean;
  editVisitorCompany: boolean;
  editVisitorCity: boolean;
};

export const defaultUserPermissions: UserPermissions = {
  editVisitorName: true,
  editVisitorCpf: true,
  editVisitorPhone: true,
  editVisitorCompany: true,
  editVisitorCity: true,
};

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "receptionist", "attendant"] }).notNull().default("receptionist"),
  sectorId: integer("sector_id").references(() => sectorsTable.id),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  permissions: jsonb("permissions").$type<UserPermissions>().notNull().default(defaultUserPermissions),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
