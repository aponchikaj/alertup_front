import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Reset from './Reset';
import * as resetApi from '../../apis/reset';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../apis/reset');

const navigateMock = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigateMock,
}));

const api = resetApi as jest.Mocked<typeof resetApi>;

const renderReset = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/reset']}>
        <Reset />
      </MemoryRouter>
    </LanguageProvider>,
  );

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(document.querySelector('button[type="submit"]') as HTMLElement);

beforeEach(() => jest.clearAllMocks());

test('a rejected send-code request stays on step 1 (regression: lowercase envelope)', async () => {
  api.SendResetCode.mockResolvedValue({ success: false, message: 'No such account' } as any);
  const user = userEvent.setup({ delay: null });
  renderReset();
  await user.type(screen.getByLabelText(/^Username or email/), 'nobody');
  await submit(user);
  expect(await screen.findByText('No such account')).toBeInTheDocument();
  expect(screen.queryByLabelText(/^Verification code/)).not.toBeInTheDocument();
});

test('full flow sends user + code + new password, then goes to login', async () => {
  api.SendResetCode.mockResolvedValue({ success: true } as any);
  api.ResetVerifyCode.mockResolvedValue({ success: true } as any);
  api.ResetNewPassword.mockResolvedValue({ success: true } as any);
  const user = userEvent.setup({ delay: null });
  renderReset();

  await user.type(screen.getByLabelText(/^Username or email/), 'nino@example.com');
  await submit(user);

  await user.type(await screen.findByLabelText(/^Verification code/), '123456');
  await submit(user);

  await user.type(await screen.findByLabelText(/^New password/), 'Str0ng!pass');
  await user.type(screen.getByLabelText(/^Repeat password/), 'Str0ng!pass');
  await submit(user);

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/login'));
  expect(api.ResetVerifyCode).toHaveBeenCalledWith({ user: 'nino@example.com', code: '123456' });
  expect(api.ResetNewPassword).toHaveBeenCalledWith({
    user: 'nino@example.com',
    newPassword: 'Str0ng!pass',
    code: '123456',
  });
});

test('a wrong code stays on step 2', async () => {
  api.SendResetCode.mockResolvedValue({ success: true } as any);
  api.ResetVerifyCode.mockResolvedValue({ success: false, message: 'Invalid code' } as any);
  const user = userEvent.setup({ delay: null });
  renderReset();
  await user.type(screen.getByLabelText(/^Username or email/), 'nino');
  await submit(user);
  await user.type(await screen.findByLabelText(/^Verification code/), '000000');
  await submit(user);
  expect(await screen.findByText('Invalid code')).toBeInTheDocument();
  expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
});

test('mismatched new passwords never reach the API', async () => {
  api.SendResetCode.mockResolvedValue({ success: true } as any);
  api.ResetVerifyCode.mockResolvedValue({ success: true } as any);
  const user = userEvent.setup({ delay: null });
  renderReset();
  await user.type(screen.getByLabelText(/^Username or email/), 'nino');
  await submit(user);
  await user.type(await screen.findByLabelText(/^Verification code/), '123456');
  await submit(user);
  await user.type(await screen.findByLabelText(/^New password/), 'Str0ng!pass');
  await user.type(screen.getByLabelText(/^Repeat password/), 'different1!A');
  await submit(user);
  expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  expect(api.ResetNewPassword).not.toHaveBeenCalled();
});
