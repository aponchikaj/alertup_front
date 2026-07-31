import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from './login';
import * as authApi from '../../apis/auth';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Regression cover for a reported bug: signing in appeared to do nothing.
 *
 * The session cookie was set correctly by the API, but the auth context reads
 * /api/me once on mount and nothing told it the answer had changed — so the
 * whole app kept rendering the visitor as a guest until a hard reload, which
 * reads to the user as "login is broken".
 *
 * The contract these tests pin: on success the page refreshes the auth context
 * BEFORE navigating, and it navigates somewhere signed-in.
 */

jest.mock('../../apis/auth');

const navigateMock = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigateMock,
}));

const refreshMock = jest.fn().mockResolvedValue(undefined);
jest.mock('../../auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => ({ status: 'guest', user: null, refresh: refreshMock }),
  default: () => ({ status: 'guest', user: null, refresh: refreshMock }),
}));

const mockAuth = authApi as jest.Mocked<typeof authApi>;

const renderLogin = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    </LanguageProvider>,
  );

const submitCredentials = async () => {
  const user = userEvent.setup();
  const inputs = document.querySelectorAll('input');
  await user.type(inputs[0], 'someone@example.com');
  await user.type(inputs[1], 'password123');
  await user.click(screen.getAllByRole('button', { name: /log ?in/i })[0]);
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('signing in', () => {
  test('refreshes the auth context before navigating', async () => {
    mockAuth.LoginUser.mockResolvedValue({
      Success: true,
      Message: 'Logged in successfully.',
      token: 'tok_abc',
    } as any);

    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    // Order matters: navigating first would render the destination while the
    // context still says "guest", which is the bug this covers.
    const refreshOrder = refreshMock.mock.invocationCallOrder[0];
    const navigateOrder = navigateMock.mock.invocationCallOrder[0];
    expect(refreshOrder).toBeLessThan(navigateOrder);

    expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('stores the Safari/iOS fallback token when the API returns one', async () => {
    mockAuth.LoginUser.mockResolvedValue({
      Success: true,
      Message: 'Logged in successfully.',
      token: 'tok_xyz',
    } as any);

    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(localStorage.getItem('userToken')).toBe('tok_xyz'));
  });

  test('a rejected sign-in neither refreshes nor navigates', async () => {
    mockAuth.LoginUser.mockResolvedValue({
      Success: false,
      Message: 'Invalid credentials.',
    } as any);

    renderLogin();
    await submitCredentials();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(refreshMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  test('a 2FA challenge advances to the code screen instead of navigating', async () => {
    // The API wrapper converts the 401 challenge into this legacy shape.
    mockAuth.LoginUser.mockResolvedValue({
      Success: false,
      Message: '2fa',
    } as any);

    renderLogin();
    await submitCredentials();

    // Still on the login flow, not sent anywhere, and not treated as an error.
    await waitFor(() => expect(navigateMock).not.toHaveBeenCalled());
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
