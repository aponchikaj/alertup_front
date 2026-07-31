import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InviteAccept from './inviteAccept';
import * as rbacApi from '../../apis/rbacApi';
import { ApiError } from '../../apis/http';
import { en } from '../../i18n/messages/en';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ToastProvider } from '../../components/ui/toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

jest.mock('../../apis/rbacApi');

jest.mock('../../auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => (globalThis as any).__authState,
  default: () => (globalThis as any).__authState,
}));

const mockRbac = rbacApi as jest.Mocked<typeof rbacApi>;

const TOKEN = 'tok-123';
const INVITED_EMAIL = 'invited@example.com';

const preview: rbacApi.InvitePreview = {
  buildingName: 'Rustaveli Tower',
  roleName: 'Fire marshal',
  email: INVITED_EMAIL,
  expiresAt: '2026-08-30T10:00:00.000Z',
  emailRegistered: true,
};

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });

const setAuth = (state: 'authed' | 'guest', email?: string) => {
  (globalThis as any).__authState = {
    status: state,
    user: state === 'authed' ? { _id: 'u1', email } : null,
    memberships: {},
    ownedBuildingIds: [],
    error: '',
    refresh: jest.fn().mockResolvedValue(undefined),
  };
};

const renderPage = (search = `?token=${TOKEN}`) =>
  render(
    <LanguageProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/invite/accept${search}`]}>
          <Routes>
            <Route path="/invite/accept" element={<InviteAccept />} />
            <Route path="/building/:id" element={<div>building page</div>} />
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>,
  );

const interpolate = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  mockRbac.getInviteByToken.mockResolvedValue(envelope(preview));
});

describe('InviteAccept', () => {
  it('accepts the invitation and lands on the building', async () => {
    setAuth('authed', INVITED_EMAIL);
    mockRbac.acceptInvite.mockResolvedValue(
      envelope({ buildingId: 'b-99', buildingName: preview.buildingName }),
    );

    renderPage();

    const accept = await screen.findByRole('button', { name: en.invite.accept });
    await userEvent.click(accept);

    await waitFor(() => expect(mockRbac.acceptInvite).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByText('building page')).toBeInTheDocument();
  });

  it('refuses to offer acceptance when the signed-in address differs', async () => {
    setAuth('authed', 'someone.else@example.com');

    renderPage();

    expect(
      await screen.findByText(
        interpolate(en.invite.wrongAccount, { email: INVITED_EMAIL }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: en.invite.accept }),
    ).not.toBeInTheDocument();
    expect(mockRbac.acceptInvite).not.toHaveBeenCalled();
  });

  it('shows the invalid-invitation state for a token the backend rejects', async () => {
    setAuth('authed', INVITED_EMAIL);
    mockRbac.getInviteByToken.mockRejectedValue(new ApiError('Not found', 404, null));

    renderPage();

    expect(await screen.findByText(en.invite.invalidTitle)).toBeInTheDocument();
    expect(screen.getByText(en.invite.invalidBody)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: en.invite.backHome }),
    ).toBeInTheDocument();
  });

  it('stashes the token and offers auth links to a guest', async () => {
    setAuth('guest');

    renderPage();

    const signIn = await screen.findByRole('link', {
      name: en.invite.signInToAccept,
    });
    expect(signIn).toHaveAttribute(
      'href',
      `/login?next=${encodeURIComponent(`/invite/accept?token=${TOKEN}`)}`,
    );
    expect(
      screen.getByRole('link', { name: en.invite.createAccountToAccept }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(sessionStorage.getItem('alertup-invite-token')).toBe(TOKEN),
    );
    expect(
      screen.queryByRole('button', { name: en.invite.accept }),
    ).not.toBeInTheDocument();
  });

  it('picks the stashed token up after signing in and auto-accepts', async () => {
    sessionStorage.setItem('alertup-invite-token', TOKEN);
    setAuth('authed', INVITED_EMAIL);
    mockRbac.acceptInvite.mockResolvedValue(
      envelope({ buildingId: 'b-99', buildingName: preview.buildingName }),
    );

    // No token in the URL — the stash is the only source.
    renderPage('');

    await waitFor(() => expect(mockRbac.acceptInvite).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByText('building page')).toBeInTheDocument();
    expect(sessionStorage.getItem('alertup-invite-token')).toBeNull();
  });
});
