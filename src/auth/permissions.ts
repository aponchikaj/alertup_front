/* ============================================================================
   Building-scoped permission model.
   Owners hold every permission implicitly; other users act through a
   per-building membership whose `permissions` list is granted by the owner.
   ========================================================================= */

export type Permission =
  | "CAN_TRIGGER_EMERGENCY"
  | "CAN_EDIT_MAP"
  | "CAN_INVITE_USERS"
  | "CAN_MANAGE_ROLES"
  | "CAN_VIEW_ANALYTICS";

export interface Membership {
  role: string;
  permissions: Permission[];
}

/**
 * True when the user may perform `perm` in `buildingId` — either because they
 * own the building (owners hold every permission implicitly) or because their
 * membership for that building includes the permission.
 */
export function hasPermission(
  memberships: Record<string, Membership>,
  ownedBuildingIds: string[],
  buildingId: string,
  perm: Permission,
): boolean {
  if (ownedBuildingIds.includes(buildingId)) return true;
  const membership = memberships[buildingId];
  return Boolean(membership?.permissions.includes(perm));
}
