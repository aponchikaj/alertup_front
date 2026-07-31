/**
 * Team / RBAC endpoints: custom roles, building members and invitations.
 *
 * Every route here answers with the lowercase `{ success, message, data }`
 * envelope (unlike the older `{ Success, Message }` routes), so the payload
 * always lives under `.data`. Errors reject as `ApiError` — call sites decide
 * what a 403/409/502 means for them, which is why the meaningful statuses are
 * exported as named constants rather than compared against magic numbers.
 */

import { get, post, del, request } from './http';
import type { Permission } from '../auth/permissions';

/** Lowercase response envelope used by the team routes. */
export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/* --- Roles --------------------------------------------------------------- */

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
  /** Only present on the list endpoint. */
  memberCount?: number;
}

/** The trimmed role shape embedded in members and invites. */
export interface RoleRef {
  id: string;
  name: string;
  permissions?: Permission[];
}

export interface RolesPayload {
  roles: Role[];
  /** Every permission the backend knows about, in its canonical order. */
  allPermissions: Permission[];
}

export interface RoleInput {
  name?: string;
  permissions?: Permission[];
}

export const listRoles = (buildingId: string) =>
  get<Envelope<RolesPayload>>(`/api/buildings/${buildingId}/roles`);

/** 409 duplicate name; 403 when granting a permission the caller lacks. */
export const createRole = (buildingId: string, input: RoleInput) =>
  post<Envelope<{ role: Role }>>(`/api/buildings/${buildingId}/roles`, input);

/** 403 for system roles (non-owner) or when the role would exceed the caller. */
export const updateRole = (buildingId: string, roleId: string, input: RoleInput) =>
  request<Envelope<{ role: Role }>>(`/api/buildings/${buildingId}/roles/${roleId}`, {
    method: 'PATCH',
    body: input,
  });

/** 403 for system roles; 409 while members still hold the role. */
export const deleteRole = (buildingId: string, roleId: string) =>
  del<Envelope<unknown>>(`/api/buildings/${buildingId}/roles/${roleId}`);

/* --- Members ------------------------------------------------------------- */

export interface Person {
  userId: string;
  name: string;
  lastname: string;
  company: string;
  email: string;
}

export interface Member extends Person {
  role: RoleRef;
  joinedAt: string;
}

export interface MembersPayload {
  /** Excluded from `members` — render it as its own pinned row. */
  owner: Person | null;
  members: Member[];
}

export const listMembers = (buildingId: string) =>
  get<Envelope<MembersPayload>>(`/api/buildings/${buildingId}/members`);

/** 403 for the owner's membership, self-changes and subset-rule violations. */
export const updateMemberRole = (buildingId: string, userId: string, roleId: string) =>
  request<Envelope<{ member: Member }>>(
    `/api/buildings/${buildingId}/members/${userId}`,
    { method: 'PATCH', body: { roleId } },
  );

/** Removing yourself is always allowed; removing others needs CAN_MANAGE_ROLES. */
export const removeMember = (buildingId: string, userId: string) =>
  del<Envelope<unknown>>(`/api/buildings/${buildingId}/members/${userId}`);

/* --- Invitations --------------------------------------------------------- */

export interface Invite {
  id: string;
  email: string;
  role: RoleRef;
  status: string;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}

export const listInvites = (buildingId: string) =>
  get<Envelope<{ invites: Invite[] }>>(`/api/buildings/${buildingId}/invites`);

/**
 * 409 when the address already belongs to a member or the owner, 403 for a
 * subset-rule violation, and **502 when the email could not be sent** — in
 * which case the backend rolls the invitation back, so the pending list has to
 * be refetched rather than optimistically appended to.
 */
export const createInvite = (buildingId: string, email: string, roleId: string) =>
  post<Envelope<{ invite: Invite }>>(`/api/buildings/${buildingId}/invites`, {
    email,
    roleId,
  });

export const resendInvite = (buildingId: string, inviteId: string) =>
  post<Envelope<unknown>>(`/api/buildings/${buildingId}/invites/${inviteId}/resend`);

export const revokeInvite = (buildingId: string, inviteId: string) =>
  del<Envelope<unknown>>(`/api/buildings/${buildingId}/invites/${inviteId}`);

/* --- Invitation acceptance (public token) -------------------------------- */

export interface InvitePreview {
  buildingName: string;
  roleName: string;
  /** The address the invitation was sent to; acceptance is bound to it. */
  email: string;
  expiresAt: string;
  emailRegistered: boolean;
}

/** PUBLIC — no session required. 404 for an invalid, expired or used token. */
export const getInviteByToken = (token: string) =>
  get<Envelope<InvitePreview>>(`/api/invites/${encodeURIComponent(token)}`);

/** Requires auth. 403 when the signed-in email differs from the invited one. */
export const acceptInvite = (token: string) =>
  post<Envelope<{ buildingId: string; buildingName: string }>>(
    `/api/invites/${encodeURIComponent(token)}/accept`,
  );
