import {
  resolvePermissions,
  type PermissionKey,
  type usersTable,
} from "@visit-control/db";

type User = Pick<typeof usersTable.$inferSelect, "role" | "permissions">;

export function userPermissions(user: User) {
  return resolvePermissions(user.role, user.permissions);
}

/** Dados do usuário que podem ser enviados ao cliente, com as permissões completas. */
export function publicUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return {
    ...rest,
    permissions: userPermissions(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString() ?? null,
  };
}

/**
 * Setor que limita o que o usuário enxerga. Usuários (exceto administradores)
 * vinculados a um setor só veem e operam informações desse setor; `null`
 * significa acesso a todos os setores.
 */
export function sectorScope(user: Pick<typeof usersTable.$inferSelect, "role" | "sectorId">): number | null {
  if (user.role === "admin") return null;
  return user.sectorId ?? null;
}

/** Verdadeiro se o usuário tiver ao menos uma das permissões informadas. */
export function hasPermission(user: User, ...keys: PermissionKey[]): boolean {
  if (user.role === "admin") return true;
  const permissions = userPermissions(user);
  return keys.some((key) => permissions[key]);
}
