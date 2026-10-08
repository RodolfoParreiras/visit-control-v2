import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { sectorsTable } from "./sectors";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Permissões atribuídas individualmente a cada usuário. Administradores têm
// acesso total; a gestão de usuários e o backup continuam exclusivos deles.
export const permissionKeys = [
  "viewDashboard",
  "viewDashboardCharts",
  "viewVisits",
  "registerVisit",
  "checkoutVisit",
  "editVisit",
  "cancelVisit",
  "reprintLabel",
  "viewVisitors",
  "createVisitor",
  "editVisitorName",
  "editVisitorCpf",
  "editVisitorBirthDate",
  "editVisitorPhone",
  "editVisitorCompany",
  "editVisitorCity",
  "accessServiceCenter",
  "viewCallDisplay",
  "viewReports",
  "manageSectors",
  "manageSettings",
  "viewAudit",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];
export type UserPermissions = Record<PermissionKey, boolean>;
export type UserRole = "admin" | "receptionist" | "attendant";

const noPermissions = Object.fromEntries(
  permissionKeys.map((key) => [key, false]),
) as UserPermissions;

const roleDefaultPermissions: Record<UserRole, UserPermissions> = {
  admin: Object.fromEntries(
    permissionKeys.map((key) => [key, true]),
  ) as UserPermissions,
  receptionist: {
    ...noPermissions,
    viewDashboard: true,
    viewVisits: true,
    registerVisit: true,
    checkoutVisit: true,
    reprintLabel: true,
    viewVisitors: true,
    createVisitor: true,
    editVisitorName: true,
    editVisitorCpf: true,
    editVisitorBirthDate: true,
    editVisitorPhone: true,
    editVisitorCompany: true,
    editVisitorCity: true,
    viewReports: true,
    viewCallDisplay: true,
  },
  attendant: { ...noPermissions, accessServiceCenter: true },
};

/** Permissões sugeridas ao criar um usuário com o perfil informado. */
export function defaultPermissionsForRole(role: UserRole): UserPermissions {
  return { ...roleDefaultPermissions[role] };
}

/**
 * Completa as permissões salvas com os padrões do perfil, ignorando chaves
 * desconhecidas. Administradores sempre recebem todas as permissões.
 */
export function resolvePermissions(
  role: UserRole,
  value: unknown,
  base: UserPermissions = defaultPermissionsForRole(role),
): UserPermissions {
  if (role === "admin") return defaultPermissionsForRole("admin");
  const input =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    permissionKeys.map((key) => [
      key,
      typeof input[key] === "boolean" ? input[key] : base[key],
    ]),
  ) as UserPermissions;
}

export const defaultUserPermissions = defaultPermissionsForRole("receptionist");

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
