import type { AdminPermission, User } from '../api/types';

/**
 * Mirrors `requirePermission` in the backend: an admin without a permission list has every permission,
 * `*` means super admin, otherwise the permission must be listed.
 */
export function hasPermission(user: Pick<User, 'role' | 'adminPermissions'> | null | undefined, permission: AdminPermission): boolean {
  if (user?.role !== 'admin') return false;
  const permissions = user.adminPermissions;
  return !Array.isArray(permissions) || permissions.includes('*') || permissions.includes(permission);
}

export function isSuperAdmin(user: Pick<User, 'role' | 'adminPermissions'> | null | undefined): boolean {
  return hasPermission(user, '*');
}

/** Merchant pages work for any signed-in account that is not an admin: students apply there first. */
export function usesMerchantArea(user: Pick<User, 'role'> | null | undefined): boolean {
  return Boolean(user && user.role !== 'admin');
}
