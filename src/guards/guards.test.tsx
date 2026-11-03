import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthGuard from './Authguard';
import PermissionGuard from './PermissionGuard';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { getBuilding } from '../apis/building';

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ============================================================================
   FX-065 — route guards, and FX-024's other half.

   The guards had no tests. Writing them found a gap: a signed-out visitor who
   opened a deep link (an invite, a building's team page) was sent to plain
   /login and, after signing in, landed on the dashboard instead of the page
   they opened. Guests now go to /login?next=<where they were going>, which
   safeNextPath() honours.
   ========================================================================= */

jest.mock('../auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => (globalThis as any).__authState,
  default: () => (globalThis as any).__authState,
}));
jest.mock('../apis/building', () => ({ getBuilding: jest.fn().mockResolvedValue({ success: false, message: 'Building not found.' }) }));

const auth = (overrides: Record<string, unknown>) => {
  (globalThis as any).__authState = {
    status: 'authed',
    user: { id: 'u1' },
    memberships: {},
    ownedBuildingIds: [],
    error: '',
    refresh: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

const Where = () => {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
};

const renderAt = (path: string, element: React.ReactNode, routePath: string) =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/login" element={<Where />} />
          <Route path="/dashboard" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );

describe('AuthGuard', () => {
  test('renders the page for a signed-in user', () => {
    auth({});
    renderAt('/settings', <AuthGuard><p>secret page</p></AuthGuard>, '/settings');
    expect(screen.getByText('secret page')).toBeInTheDocument();
  });

  test('sends a guest to /login with ?next= so they come back after signing in', async () => {
    auth({ status: 'guest', refresh: jest.fn().mockResolvedValue(undefined) });
    renderAt('/building/b1/members?tab=roles', <AuthGuard><p>secret page</p></AuthGuard>, '/building/:buildingId/members');
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/login?next=' + encodeURIComponent('/building/b1/members?tab=roles'),
    );
  });
});

describe('PermissionGuard', () => {
  const guarded = (
    <PermissionGuard permission="CAN_VIEW_ANALYTICS">
      <p>analytics</p>
    </PermissionGuard>
  );

  test('lets a member with the permission through', () => {
    auth({ memberships: { b1: { role: 'Analyst', permissions: ['CAN_VIEW_ANALYTICS'] } } });
    renderAt('/building/b1/analytics', guarded, '/building/:buildingId/analytics');
    expect(screen.getByText('analytics')).toBeInTheDocument();
  });

  test('lets the owner through', () => {
    auth({ ownedBuildingIds: ['b1'] });
    renderAt('/building/b1/analytics', guarded, '/building/:buildingId/analytics');
    expect(screen.getByText('analytics')).toBeInTheDocument();
  });

  test('sends a member without the permission to the dashboard', async () => {
    auth({ memberships: { b1: { role: 'Staff', permissions: [] } } });
    renderAt('/building/b1/analytics', guarded, '/building/:buildingId/analytics');
    expect(await screen.findByTestId('where')).toHaveTextContent('/dashboard');
    expect(screen.queryByText('analytics')).not.toBeInTheDocument();
  });

  test('sends a guest to /login with ?next=', async () => {
    auth({ status: 'guest' });
    renderAt('/building/b1/analytics', guarded, '/building/:buildingId/analytics');
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/login?next=' + encodeURIComponent('/building/b1/analytics'),
    );
  });

  // FX-067: the ownership fallback reads the building from `data`.
  test('the ownership fallback lets the owner of `data` through', async () => {
    (getBuilding as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: { id: 'b1', owner: 'u1' },
    });
    auth({});
    renderAt('/building/b1/analytics', guarded, '/building/:buildingId/analytics');
    expect(await screen.findByText('analytics')).toBeInTheDocument();
  });

  test('the ownership fallback denies anyone else', async () => {
    (getBuilding as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: { id: 'b1', owner: 'someone-else' },
    });
    auth({});
    renderAt('/building/b1/analytics', guarded, '/building/:buildingId/analytics');
    expect(await screen.findByTestId('where')).toHaveTextContent('/dashboard');
  });
});
