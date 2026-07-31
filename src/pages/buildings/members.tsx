import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import { useAuth } from "../../auth/useAuth";
import { hasPermission, type Permission } from "../../auth/permissions";
import { ApiError, errorMessage } from "../../apis/http";
import {
  listMembers,
  listRoles,
  listInvites,
  updateMemberRole,
  removeMember,
  createInvite,
  resendInvite,
  revokeInvite,
  createRole,
  updateRole,
  deleteRole,
  type Invite,
  type Member,
  type Person,
  type Role,
} from "../../apis/rbacApi";
import { usePageAnimations } from "../../lib/animations";
import { cn } from "../../lib/cn";
import { PageHeader, PageShell } from "../../components/ui/layout";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Alert, Badge, EmptyState, Skeleton } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { TextField } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { DataTable, type Column } from "../../components/ui/table";
import { Tab, TabList, TabPanel, Tabs } from "../../components/ui/tabs";
import { ConfirmDialog } from "../../components/ui/confirmDialog";
import { useToast } from "../../components/ui/toast";
import {
  AlertTriangleIcon,
  MailIcon,
  PlusIcon,
  RefreshIcon,
  ShieldCheckIcon,
  TrashIcon,
  UsersIcon,
} from "../../components/ui/icons";

/* ============================================================================
   Team management — members, invitations and custom roles for one building.

   Permissions are read from the members payload rather than only from the auth
   context: /api/me does not return memberships yet, so trusting the context
   alone would hide the controls from people who actually hold them. The server
   re-checks every mutation, so this only decides what is worth rendering.
   ========================================================================= */

/** Canonical order, used when the backend does not send `allPermissions`. */
const FALLBACK_PERMISSIONS: Permission[] = [
  "CAN_TRIGGER_EMERGENCY",
  "CAN_EDIT_MAP",
  "CAN_INVITE_USERS",
  "CAN_MANAGE_ROLES",
  "CAN_VIEW_ANALYTICS",
];

/** Permission -> the `members.perm*` / `members.perm*Hint` key suffix. */
const PERMISSION_KEY: Record<Permission, string> = {
  CAN_TRIGGER_EMERGENCY: "TriggerEmergency",
  CAN_EDIT_MAP: "EditMap",
  CAN_INVITE_USERS: "InviteUsers",
  CAN_MANAGE_ROLES: "ManageRoles",
  CAN_VIEW_ANALYTICS: "ViewAnalytics",
};

const isKnownPermission = (value: string): value is Permission =>
  value in PERMISSION_KEY;

const statusOf = (err: unknown): number =>
  err instanceof ApiError ? err.status : 0;

const fullName = (person: Person): string =>
  [person.name, person.lastname].filter(Boolean).join(" ").trim() || person.email;

/** A member row plus the pinned owner row, which has no membership record. */
interface MemberRow {
  id: string;
  isOwner: boolean;
  person: Person;
  member: Member | null;
}

const LoadingState = () => (
  <div className="flex flex-col gap-4 pt-8" role="status" aria-live="polite">
    <Skeleton className="h-10 w-72 max-w-full" />
    <Skeleton className="h-64" />
  </div>
);

const MembersPage = () => {
  const rootRef = usePageAnimations();
  const { buildingId = "" } = useParams<{ buildingId: string }>();
  const { t } = useI18n();
  const { toast } = useToast();
  const { user, memberships, ownedBuildingIds } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [owner, setOwner] = useState<Person | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>(FALLBACK_PERMISSIONS);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [tab, setTab] = useState("members");

  const myId = String(user?._id ?? user?.id ?? "");

  /* --- Load -------------------------------------------------------------- */

  const loadCore = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setLoadError("");
    try {
      const [membersRes, rolesRes] = await Promise.all([
        listMembers(buildingId),
        listRoles(buildingId),
      ]);
      setOwner(membersRes.data?.owner ?? null);
      setMembers(membersRes.data?.members ?? []);
      setRoles(rolesRes.data?.roles ?? []);
      const perms = (rolesRes.data?.allPermissions ?? []).filter(isKnownPermission);
      setAllPermissions(perms.length ? perms : FALLBACK_PERMISSIONS);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  /* --- Viewer capabilities ---------------------------------------------- */

  const viewerIsOwner =
    (Boolean(myId) && owner?.userId === myId) || ownedBuildingIds.includes(buildingId);

  const viewerPermissions = useMemo<Permission[]>(() => {
    if (viewerIsOwner) return allPermissions;
    const mine = members.find((m) => m.userId === myId);
    if (mine?.role?.permissions?.length) return mine.role.permissions;
    return memberships[buildingId]?.permissions ?? [];
  }, [viewerIsOwner, allPermissions, members, myId, memberships, buildingId]);

  const can = useCallback(
    (permission: Permission) =>
      viewerIsOwner ||
      viewerPermissions.includes(permission) ||
      hasPermission(memberships, ownedBuildingIds, buildingId, permission),
    [viewerIsOwner, viewerPermissions, memberships, ownedBuildingIds, buildingId],
  );

  const canManageRoles = can("CAN_MANAGE_ROLES");
  const canInvite = can("CAN_INVITE_USERS");

  // A tab that disappears when permissions resolve must not leave the panel
  // area blank — fall back to the always-present Members tab.
  useEffect(() => {
    if (tab === "invites" && !canInvite) setTab("members");
    if (tab === "roles" && !canManageRoles) setTab("members");
  }, [tab, canInvite, canManageRoles]);

  const loadInvites = useCallback(async () => {
    if (!buildingId) return;
    try {
      const res = await listInvites(buildingId);
      setInvites(res.data?.invites ?? []);
    } catch {
      // The list is secondary to the page; a failure here must not blank it.
      setInvites([]);
    }
  }, [buildingId]);

  useEffect(() => {
    if (canInvite) loadInvites();
  }, [canInvite, loadInvites]);

  /* --- Labels ------------------------------------------------------------ */

  const permissionLabel = useCallback(
    (permission: string) =>
      isKnownPermission(permission)
        ? t(`members.perm${PERMISSION_KEY[permission]}`)
        : permission,
    [t],
  );

  const permissionHint = useCallback(
    (permission: Permission) => t(`members.perm${PERMISSION_KEY[permission]}Hint`),
    [t],
  );

  const formatDate = useCallback((value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  }, []);

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.id, label: role.name })),
    [roles],
  );

  /* --- Members mutations ------------------------------------------------- */

  const [pendingRoleFor, setPendingRoleFor] = useState("");
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);

  const changeRole = async (userId: string, roleId: string) => {
    setPendingRoleFor(userId);
    try {
      const res = await updateMemberRole(buildingId, userId, roleId);
      const updated = res.data?.member;
      setMembers((current) =>
        current.map((m) =>
          m.userId === userId
            ? updated ?? {
                ...m,
                role: roles.find((r) => r.id === roleId) ?? m.role,
              }
            : m,
        ),
      );
      toast({ title: t("members.roleUpdated"), tone: "success" });
      // memberCount per role changed; refresh so the Roles tab stays honest.
      listRoles(buildingId)
        .then((r) => setRoles(r.data?.roles ?? []))
        .catch(() => undefined);
    } catch (err) {
      toast({ title: t("common.error"), description: errorMessage(err), tone: "danger" });
      // Snap the Select back to what the server still believes.
      setMembers((current) => [...current]);
    } finally {
      setPendingRoleFor("");
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMember(buildingId, removeTarget.id);
      setMembers((current) => current.filter((m) => m.userId !== removeTarget.id));
      toast({ title: t("members.memberRemoved"), tone: "success" });
      setRemoveTarget(null);
    } catch (err) {
      toast({ title: t("common.error"), description: errorMessage(err), tone: "danger" });
      throw err; // Keeps the dialog open for another attempt.
    }
  };

  /* --- Invitations ------------------------------------------------------- */

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [busyInviteId, setBusyInviteId] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null);

  // Default the role picker to the first available role once roles arrive.
  useEffect(() => {
    if (!inviteRoleId && roles.length) setInviteRoleId(roles[0].id);
  }, [roles, inviteRoleId]);

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError("");
    setInviteBusy(true);
    try {
      await createInvite(buildingId, inviteEmail.trim(), inviteRoleId);
      toast({ title: t("members.inviteSent"), tone: "success" });
      setInviteEmail("");
      await loadInvites();
    } catch (err) {
      // 502: the backend rolled the invitation back, so the pending list must
      // be refetched rather than assumed to contain the new row.
      const emailFailed = statusOf(err) === 502;
      const message = emailFailed ? t("members.errorInviteEmail") : errorMessage(err);
      setInviteError(message);
      toast({ title: t("common.error"), description: message, tone: "danger" });
      if (emailFailed) await loadInvites();
    } finally {
      setInviteBusy(false);
    }
  };

  const doResend = async (invite: Invite) => {
    setBusyInviteId(invite.id);
    try {
      await resendInvite(buildingId, invite.id);
      toast({ title: t("members.resent"), tone: "success" });
    } catch (err) {
      toast({ title: t("common.error"), description: errorMessage(err), tone: "danger" });
    } finally {
      setBusyInviteId("");
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeInvite(buildingId, revokeTarget.id);
      setInvites((current) => current.filter((i) => i.id !== revokeTarget.id));
      toast({ title: t("members.revoked"), tone: "success" });
      setRevokeTarget(null);
    } catch (err) {
      toast({ title: t("common.error"), description: errorMessage(err), tone: "danger" });
      throw err;
    }
  };

  /* --- Roles ------------------------------------------------------------- */

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);
  const [deleteRoleError, setDeleteRoleError] = useState("");

  const resetRoleForm = () => {
    setEditingRole(null);
    setRoleName("");
    setRolePermissions([]);
    setRoleError("");
  };

  const startEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRolePermissions(role.permissions.filter(isKnownPermission));
    setRoleError("");
    setTab("roles");
  };

  const togglePermission = (permission: Permission) => {
    setRolePermissions((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  };

  /**
   * The two refusals the role builder can produce are policy decisions, not
   * plumbing failures, so they get their own copy instead of a raw server
   * string the user cannot act on.
   */
  const roleErrorText = (err: unknown, kind: "save" | "delete"): string => {
    const status = statusOf(err);
    if (status === 403) return t("members.errorEscalation");
    if (status === 409) {
      return kind === "delete"
        ? t("members.errorRoleInUse")
        : t("members.errorDuplicateRole");
    }
    return errorMessage(err);
  };

  const submitRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRoleError("");
    setRoleBusy(true);
    try {
      if (editingRole) {
        await updateRole(buildingId, editingRole.id, {
          name: roleName.trim(),
          permissions: rolePermissions,
        });
        toast({ title: t("members.roleSaved"), tone: "success" });
      } else {
        await createRole(buildingId, {
          name: roleName.trim(),
          permissions: rolePermissions,
        });
        toast({ title: t("members.roleCreated"), tone: "success" });
      }
      resetRoleForm();
      const res = await listRoles(buildingId);
      setRoles(res.data?.roles ?? []);
    } catch (err) {
      setRoleError(roleErrorText(err, "save"));
    } finally {
      setRoleBusy(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    setDeleteRoleError("");
    try {
      await deleteRole(buildingId, deleteRoleTarget.id);
      setRoles((current) => current.filter((r) => r.id !== deleteRoleTarget.id));
      toast({ title: t("common.delete"), tone: "success" });
      setDeleteRoleTarget(null);
    } catch (err) {
      setDeleteRoleError(roleErrorText(err, "delete"));
      throw err;
    }
  };

  /* --- Rows -------------------------------------------------------------- */

  const rows = useMemo<MemberRow[]>(() => {
    const list: MemberRow[] = [];
    if (owner) list.push({ id: owner.userId, isOwner: true, person: owner, member: null });
    for (const member of members) {
      list.push({ id: member.userId, isOwner: false, person: member, member });
    }
    return list;
  }, [owner, members]);

  const memberColumns = useMemo<Column<MemberRow>[]>(
    () => [
      {
        key: "name",
        header: t("members.name"),
        render: (row) => (
          <span className="block">
            <span className="block font-medium text-ink">{fullName(row.person)}</span>
            {row.person.company && (
              <span className="block text-xs text-ink-subtle">{row.person.company}</span>
            )}
          </span>
        ),
      },
      {
        key: "email",
        header: t("members.email"),
        render: (row) => <span className="break-all">{row.person.email}</span>,
      },
      {
        key: "role",
        header: t("members.role"),
        render: (row) => {
          if (row.isOwner) return <Badge tone="brand">{t("members.owner")}</Badge>;
          const member = row.member!;
          const isSelf = member.userId === myId;
          if (!canManageRoles || isSelf) {
            return <Badge>{member.role?.name ?? "—"}</Badge>;
          }
          return (
            <Select
              aria-label={`${t("members.changeRole")} — ${fullName(row.person)}`}
              options={roleOptions}
              value={member.role?.id ?? ""}
              disabled={pendingRoleFor === member.userId}
              onChange={(event) => changeRole(member.userId, event.target.value)}
              selectClassName="min-w-[10rem] py-2 text-sm"
            />
          );
        },
      },
      {
        key: "joined",
        header: t("members.joined"),
        render: (row) =>
          row.isOwner ? (
            <span aria-hidden="true">—</span>
          ) : (
            <span>{formatDate(row.member!.joinedAt)}</span>
          ),
      },
      {
        key: "actions",
        header: t("members.actions"),
        className: "text-right",
        render: (row) => {
          // The owner can never be removed and their membership is immutable,
          // so the row carries no controls at all.
          if (row.isOwner) return null;
          const isSelf = row.member!.userId === myId;
          if (!isSelf && !canManageRoles) return null;
          return (
            <Button
              type="button"
              size="sm"
              variant={isSelf ? "secondary" : "danger"}
              onClick={() => setRemoveTarget(row)}
            >
              <TrashIcon size={15} />
              {t("members.remove")}
              <span className="sr-only"> {fullName(row.person)}</span>
            </Button>
          );
        },
      },
    ],
    // changeRole/setRemoveTarget are stable enough for this table's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, myId, canManageRoles, roleOptions, pendingRoleFor, formatDate],
  );

  const inviteColumns = useMemo<Column<Invite>[]>(
    () => [
      {
        key: "email",
        header: t("members.email"),
        render: (invite) => (
          <span className="break-all font-medium text-ink">{invite.email}</span>
        ),
      },
      {
        key: "role",
        header: t("members.role"),
        render: (invite) => <Badge>{invite.role?.name ?? "—"}</Badge>,
      },
      {
        key: "expires",
        header: t("members.expires", { date: "" }).trim(),
        render: (invite) =>
          invite.expired ? (
            <Badge tone="danger">{t("members.expired")}</Badge>
          ) : (
            <span>{t("members.expires", { date: formatDate(invite.expiresAt) })}</span>
          ),
      },
      {
        key: "actions",
        header: t("members.actions"),
        className: "text-right",
        render: (invite) => (
          <span className="inline-flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busyInviteId === invite.id}
              onClick={() => doResend(invite)}
            >
              <RefreshIcon size={15} />
              {t("members.resend")}
              <span className="sr-only"> {invite.email}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => setRevokeTarget(invite)}
            >
              {t("members.revoke")}
              <span className="sr-only"> {invite.email}</span>
            </Button>
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, busyInviteId, formatDate],
  );

  /* --- Render ------------------------------------------------------------ */

  let body: ReactNode;

  if (loading) {
    body = <LoadingState />;
  } else if (loadError) {
    body = (
      <div className="pt-8">
        <EmptyState
          icon={<AlertTriangleIcon size={24} />}
          title={t("common.error")}
          description={loadError}
          action={
            <Button type="button" onClick={() => loadCore()}>
              <RefreshIcon size={16} />
              {t("common.retry")}
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <Tabs value={tab} onValueChange={setTab} className="pt-8">
        <TabList aria-label={t("members.title")}>
          <Tab value="members">
            <UsersIcon size={16} />
            {t("members.tabMembers")}
          </Tab>
          {canInvite && (
            <Tab value="invites">
              <MailIcon size={16} />
              {t("members.tabInvites")}
            </Tab>
          )}
          {canManageRoles && (
            <Tab value="roles">
              <ShieldCheckIcon size={16} />
              {t("members.tabRoles")}
            </Tab>
          )}
        </TabList>

        {/* ---- Members ---- */}
        <TabPanel value="members">
          <DataTable
            caption={t("members.tabMembers")}
            columns={memberColumns}
            rows={rows}
            rowKey={(row) => row.id}
            emptyLabel={t("members.noMembers")}
          />
        </TabPanel>

        {/* ---- Invitations ---- */}
        {canInvite && (
          <TabPanel value="invites">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("members.inviteTitle")}</CardTitle>
                </CardHeader>
                <CardBody>
                  <form
                    onSubmit={submitInvite}
                    aria-label={t("members.inviteTitle")}
                    className="flex flex-col gap-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label={t("members.inviteEmail")}
                        type="email"
                        required
                        autoComplete="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                      />
                      <Select
                        label={t("members.inviteRole")}
                        required
                        options={roleOptions}
                        value={inviteRoleId}
                        onChange={(event) => setInviteRoleId(event.target.value)}
                      />
                    </div>

                    {inviteError && <Alert tone="danger">{inviteError}</Alert>}

                    <div>
                      <Button type="submit" loading={inviteBusy}>
                        <MailIcon size={16} />
                        {t("members.sendInvite")}
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>

              <section aria-label={t("members.pendingInvites")}>
                <h2 className="mb-3 text-lg font-semibold text-ink">
                  {t("members.pendingInvites")}
                </h2>
                <DataTable
                  caption={t("members.pendingInvites")}
                  columns={inviteColumns}
                  rows={invites}
                  rowKey={(invite) => invite.id}
                  emptyLabel={t("members.noPendingInvites")}
                />
              </section>
            </div>
          </TabPanel>
        )}

        {/* ---- Roles ---- */}
        {canManageRoles && (
          <TabPanel value="roles">
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingRole ? t("members.saveRole") : t("members.newRole")}
                  </CardTitle>
                  <CardDescription>{t("members.description")}</CardDescription>
                </CardHeader>
                <CardBody>
                  <form
                    onSubmit={submitRole}
                    aria-label={editingRole ? t("members.saveRole") : t("members.newRole")}
                    className="flex flex-col gap-5"
                  >
                    <TextField
                      label={t("members.roleName")}
                      required
                      value={roleName}
                      onChange={(event) => setRoleName(event.target.value)}
                    />

                    <fieldset className="flex flex-col gap-2 border-0 p-0">
                      <legend className="mb-1 text-sm font-medium text-ink">
                        {t("members.permissions")}
                      </legend>
                      {allPermissions.map((permission) => (
                        <label
                          key={permission}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border border-line",
                            "bg-surface-2 p-3 transition-colors hover:border-line-strong",
                            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-current"
                            checked={rolePermissions.includes(permission)}
                            onChange={() => togglePermission(permission)}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink">
                              {permissionLabel(permission)}
                            </span>
                            <span className="block text-xs text-ink-subtle">
                              {permissionHint(permission)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>

                    {roleError && <Alert tone="danger">{roleError}</Alert>}

                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" loading={roleBusy}>
                        <PlusIcon size={16} />
                        {editingRole ? t("members.saveRole") : t("members.createRole")}
                      </Button>
                      {editingRole && (
                        <Button type="button" variant="secondary" onClick={resetRoleForm}>
                          {t("common.cancel")}
                        </Button>
                      )}
                    </div>
                  </form>
                </CardBody>
              </Card>

              <ul className="flex flex-col gap-4" aria-label={t("members.tabRoles")}>
                {roles.map((role) => (
                  <li key={role.id}>
                    <Card className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                            {role.name}
                            {role.isSystem && (
                              <Badge tone="info">{t("members.systemRole")}</Badge>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-ink-subtle">
                            {t("members.memberCount", { count: role.memberCount ?? 0 })}
                            {role.isSystem && ` · ${t("members.systemRoleHint")}`}
                          </p>
                        </div>

                        {!role.isSystem && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEditRole(role)}
                            >
                              {t("members.saveRole")}
                              <span className="sr-only"> {role.name}</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setDeleteRoleError("");
                                setDeleteRoleTarget(role);
                              }}
                            >
                              <TrashIcon size={15} />
                              {t("members.deleteRole")}
                              <span className="sr-only"> {role.name}</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.permissions.length === 0 ? (
                          <span className="text-xs text-ink-subtle">—</span>
                        ) : (
                          role.permissions.map((permission) => (
                            <Badge key={permission}>{permissionLabel(permission)}</Badge>
                          ))
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          </TabPanel>
        )}
      </Tabs>
    );
  }

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader title={t("members.title")} description={t("members.description")} />
        </div>

        {body}

        <ConfirmDialog
          open={Boolean(removeTarget)}
          onClose={() => setRemoveTarget(null)}
          onConfirm={confirmRemove}
          title={t("members.removeConfirmTitle")}
          body={t("members.removeConfirmBody")}
          confirmLabel={t("members.remove")}
          cancelLabel={t("common.cancel")}
          tone="danger"
        />

        <ConfirmDialog
          open={Boolean(revokeTarget)}
          onClose={() => setRevokeTarget(null)}
          onConfirm={confirmRevoke}
          title={t("members.revokeConfirmTitle")}
          body={t("members.revokeConfirmBody")}
          confirmLabel={t("members.revoke")}
          cancelLabel={t("common.cancel")}
          tone="danger"
        />

        {/* Deleting a role can strip capabilities from everyone holding it, so
            it asks for the role name to be typed rather than a single click. */}
        <ConfirmDialog
          open={Boolean(deleteRoleTarget)}
          onClose={() => {
            setDeleteRoleTarget(null);
            setDeleteRoleError("");
          }}
          onConfirm={confirmDeleteRole}
          title={t("members.deleteRoleConfirmTitle")}
          body={
            <>
              <p>{t("members.deleteRoleConfirmBody")}</p>
              {deleteRoleError && (
                <div className="mt-3">
                  <Alert tone="danger">{deleteRoleError}</Alert>
                </div>
              )}
            </>
          }
          requireText={deleteRoleTarget?.name}
          requireTextLabel={t("members.roleName")}
          confirmLabel={t("members.deleteRole")}
          cancelLabel={t("common.cancel")}
          tone="danger"
        />
      </PageShell>
    </div>
  );
};

export default MembersPage;
