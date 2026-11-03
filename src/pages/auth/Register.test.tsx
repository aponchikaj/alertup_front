import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import * as authApi from '../../apis/auth';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

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

const renderRegister = (entry = '/register') =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Register />
      </MemoryRouter>
    </LanguageProvider>,
  );

const fill = async (password: string, repeat = password) => {
  const user = userEvent.setup({ delay: null });
  await user.type(screen.getByLabelText(/^Name/), 'Nino');
  await user.type(screen.getByLabelText(/^Last name/), 'Beridze');
  await user.type(screen.getByLabelText(/^Email/), 'nino@example.com');
  await user.selectOptions(screen.getByLabelText(/^Country/), 'Georgia');
  await user.type(screen.getByLabelText(/^Phone number/), '555123456');
  await user.type(screen.getByLabelText(/^Password/), password);
  await user.type(screen.getByLabelText(/^Repeat password/), repeat);
  await user.click(document.querySelector('button[type="submit"]') as HTMLElement);
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('mismatched passwords never reach the API', async () => {
  renderRegister();
  await fill('Str0ng!pass', 'Str0ng!pasz');
  expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  expect(mockAuth.RegisterUser).not.toHaveBeenCalled();
});

test('a weak password is rejected client-side', async () => {
  renderRegister();
  await fill('weakpass');
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(mockAuth.RegisterUser).not.toHaveBeenCalled();
});

test('sends the English country name and its phone code', async () => {
  mockAuth.RegisterUser.mockResolvedValue({ success: true, message: 'Registered successfully.' } as any);
  renderRegister();
  await fill('Str0ng!pass');
  await waitFor(() => expect(mockAuth.RegisterUser).toHaveBeenCalled());
  expect(mockAuth.RegisterUser.mock.calls[0][0]).toMatchObject({
    name: 'Nino',
    email: 'nino@example.com',
    country: 'Georgia',
    countryCode: '+995',
    userType: 'Individual',
  });
});

test('success refreshes the session before following a safe ?next', async () => {
  mockAuth.RegisterUser.mockResolvedValue({ success: true, message: 'Registered successfully.' } as any);
  renderRegister('/register?next=%2Finvite%2Faccept%3Ftoken%3Dabc');
  await fill('Str0ng!pass');
  await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  expect(refreshMock.mock.invocationCallOrder[0]).toBeLessThan(
    navigateMock.mock.invocationCallOrder[0],
  );
  expect(navigateMock).toHaveBeenCalledWith('/invite/accept?token=abc', { replace: true });
});

test('an off-site ?next falls back to the dashboard', async () => {
  mockAuth.RegisterUser.mockResolvedValue({ success: true, message: 'Registered successfully.' } as any);
  renderRegister('/register?next=%2F%2Fevil.example');
  await fill('Str0ng!pass');
  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));
});

test('a server rejection is shown and nothing navigates', async () => {
  mockAuth.RegisterUser.mockResolvedValue({ success: false, message: 'Email already in use' } as any);
  renderRegister();
  await fill('Str0ng!pass');
  expect(await screen.findByText('Email already in use')).toBeInTheDocument();
  expect(refreshMock).not.toHaveBeenCalled();
  expect(navigateMock).not.toHaveBeenCalled();
});
