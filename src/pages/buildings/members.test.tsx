import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Members from './members';
import * as rbacApi from '../../apis/rbacApi';
import { ApiError } from '../../apis/http';
import { en } from '../../i18n/messages/en';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ToastProvider } from '../../components/ui/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The page's reveal animations (animejs onScroll) construct a ResizeObserver
// on mount, which jsdom does not implement.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

jest.mock('../../apis/rbacApi');

// The auth state is swapped per test. Reading it off globalThis keeps the
// factory free of the temporal-dead-zone problem a `let` closure would hit,
// since jest hoists jest.mock above every declaration in this file.
jest.mock('../../auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => (globalThis as any).__authState,
  default: () => (globalThis as any).__authState,
}));

const mockRbac = rbacApi as jest.Mocked<typeof rbacApi>;

const BUILDING_ID = 'b1';

const owner: rbacApi.Person = {
  userId: 'u-owner',
  name: 'Nino',
  lastname: 'Owner',
  company: 'AlertUp',
  email: 'owner@example.com',
};

const viewerMember: rbacApi.Member = {
  userId: 'u-viewer',
  name: 'Vano',
  lastname: 'Viewer',
  company: '',
  email: 'viewer@example.com',
  role: { id: 'r-staff', name: 'Staff', permissions: [] },
  joinedAt: '2026-01-05T10:00:00.000Z',
};

const otherMember: rbacApi.Member = {
  userId: 'u-other',
  name: 'Lika',
  lastname: 'Other',
  company: '',
  email: 'other@example.com',
  role: { id: 'r-staff', name: 'Staff', permissions: [] },
  joinedAt: '2026-02-05T10:00:00.000Z',
};

const roles: rbacApi.Role[] = [
  {
    id: 'r-staff',
    name: 'Staff',
    permissions: [],
    isSystem: true,
    memberCount: 2,
  },
  {
    id: 'r-marshal',
    name: 'Fire marshal',
    permissions: ['CAN_TRIGGER_EMERGENCY'],
    isSystem: false,
    memberCount: 0,
  },
];

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });

/** Sets the mocked auth context for the test that follows. */
const setAuth = (userId: string, permissions: string[] = [], isOwner = false) => {
  (globalThis as any).__authState = {
    status: 'authed',
    user: { _id: userId, email: `${userId}@example.com` },
    memberships: permissions.length
      ? { [BUILDING_ID]: { role: 'Custom', permissions } }
      : {},
    ownedBuildingIds: isOwner ? [BUILDING_ID] : [],
    error: '',
    refresh: jest.fn().mockResolvedValue(undefined),
  };
};

const renderPage = () =>
  render(
    <LanguageProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/building/${BUILDING_ID}/members`]}>
          <Routes>
            <Route path="/building/:buildingId/members" element={<Members />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();

  mockRbac.listMembers.mockResolvedValue(
    envelope({ owner, members: [viewerMember, otherMember] }),
  );
  mockRbac.listRoles.mockResolvedValue(
    envelope({
      roles,
      allPermissions: [
        'CAN_TRIGGER_EMERGENCY',
        'CAN_EDIT_MAP',
        'CAN_INVITE_USERS',
        'CAN_MANAGE_ROLES',
        'CAN_VIEW_ANALYTICS',
      ],
    }),
  );
  mockRbac.listInvites.mockResolvedValue(envelope({ invites: [] }));
});

describe('Members page — permission gating', () => {
  it('renders roles as plain badges and hides the role picker without CAN_MANAGE_ROLES', async () => {
    setAuth('u-viewer');
    renderPage();

    await screen.findByRole('tab', { name: en.members.tabMembers });

    // The owner is pinned with an owner badge and no controls.
    expect(await screen.findByText(en.members.owner)).toBeInTheDocument();
    expect(screen.getAllByText('Staff').length).toBeGreaterThan(0);

    // No role <select> anywhere, and no privileged tabs.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: en.members.tabRoles }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: en.members.tabInvites }),
    ).not.toBeInTheDocument();
  });

  it('renders a role picker for other members when the viewer can manage roles', async () => {
    setAuth('u-owner', [], true);
    renderPage();

    // One picker per non-owner member; the owner row never gets one.
    const pickers = await screen.findAllByRole('combobox', {
      name: new RegExp(en.members.changeRole),
    });
    expect(pickers).toHaveLength(2);
    expect(
      screen.getByRole('tab', { name: en.members.tabRoles }),
    ).toBeInTheDocument();
  });
});

describe('Members page — invitations', () => {
  const asInviter = () => setAuth('u-viewer', ['CAN_INVITE_USERS']);

  const openInvitesTab = async () => {
    const tab = await screen.findByRole('tab', { name: en.members.tabInvites });
    await userEvent.click(tab);
  };

  it('sends an invitation and refreshes the pending list', async () => {
    asInviter();
    mockRbac.createInvite.mockResolvedValue(envelope({ invite: {} as rbacApi.Invite }));
    renderPage();

    await openInvitesTab();

    await userEvent.type(
      // The label carries a trailing required marker, hence the loose match.
      screen.getByLabelText(en.members.inviteEmail, { exact: false }),
      'new.person@example.com',
    );
    await userEvent.click(
      screen.getByRole('button', { name: en.members.sendInvite }),
    );

    await waitFor(() =>
      expect(mockRbac.createInvite).toHaveBeenCalledWith(
        BUILDING_ID,
        'new.person@example.com',
        'r-staff',
      ),
    );
    expect(await screen.findByText(en.members.inviteSent)).toBeInTheDocument();
    // Initial load + the refetch after a successful send.
    await waitFor(() => expect(mockRbac.listInvites).toHaveBeenCalledTimes(2));
  });

  it('explains the 502 rollback and refetches, because the invite no longer exists', async () => {
    asInviter();
    mockRbac.createInvite.mockRejectedValue(
      new ApiError('Bad gateway', 502, null),
    );
    renderPage();

    await openInvitesTab();

    await userEvent.type(
      // The label carries a trailing required marker, hence the loose match.
      screen.getByLabelText(en.members.inviteEmail, { exact: false }),
      'undeliverable@example.com',
    );
    await userEvent.click(
      screen.getByRole('button', { name: en.members.sendInvite }),
    );

    // Surfaced twice on purpose: inline under the form and as a toast.
    expect(
      (await screen.findAllByText(en.members.errorInviteEmail)).length,
    ).toBeGreaterThan(0);
    // The raw transport message is never shown for this case.
    expect(screen.queryByText('Bad gateway')).not.toBeInTheDocument();
    await waitFor(() => expect(mockRbac.listInvites).toHaveBeenCalledTimes(2));
  });
});

describe('Members page — custom roles', () => {
  const openRolesTab = async () => {
    const tab = await screen.findByRole('tab', { name: en.members.tabRoles });
    await userEvent.click(tab);
  };

  it('shows a friendly message instead of the raw anti-escalation 403', async () => {
    setAuth('u-owner', [], true);
    mockRbac.createRole.mockRejectedValue(
      new ApiError('Cannot grant a permission you do not hold', 403, null),
    );
    renderPage();

    await openRolesTab();

    await userEvent.type(
      screen.getByLabelText(en.members.roleName, { exact: false }),
      'Deputy',
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: new RegExp(en.members.permManageRoles) }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: en.members.createRole }),
    );

    expect(
      await screen.findByText(en.members.errorEscalation),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Cannot grant a permission you do not hold'),
    ).not.toBeInTheDocument();
  });

  it('marks built-in roles read-only', async () => {
    setAuth('u-owner', [], true);
    renderPage();

    await openRolesTab();

    expect(await screen.findByText(en.members.systemRole)).toBeInTheDocument();
    // "Staff" is a system role: no delete button is offered for it.
    const deleteButtons = screen.queryAllByRole('button', {
      name: new RegExp(`${en.members.deleteRole} Staff`),
    });
    expect(deleteButtons).toHaveLength(0);
  });
});
