import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';
import * as settingsApi from '../../apis/settings';
import * as twoFactorApi from '../../apis/twoFactorAuth';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* FX-067 — the account form is filled from `data`; every action shows the
   server's `message` when it is refused. */

jest.mock('../../apis/settings');
jest.mock('../../apis/twoFactorAuth');
const mockSettings = settingsApi as jest.Mocked<typeof settingsApi>;
const mock2fa = twoFactorApi as jest.Mocked<typeof twoFactorApi>;

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const account = {
  name: 'Nino',
  lastname: 'Beridze',
  phone: '555123456',
  country: 'Georgia',
  userType: 'Individual',
  verified: true,
  TwoFactorEnabled: false,
};

const renderSettings = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

beforeEach(() => jest.clearAllMocks());

test('fills the form from `data`', async () => {
  mockSettings.getSettings.mockResolvedValue({ success: true, message: 'OK', data: account });

  await renderSettings();

  expect(screen.getByLabelText('Name')).toHaveValue('Nino');
  expect(screen.getByLabelText('Lastname')).toHaveValue('Beridze');
});

test('a failed load shows the server message', async () => {
  mockSettings.getSettings.mockResolvedValue({ success: false, message: 'User not found.' });

  await renderSettings();

  expect(screen.getByText('User not found.')).toBeInTheDocument();
});

test('a refused 2FA activation shows the server message', async () => {
  mockSettings.getSettings.mockResolvedValue({ success: true, message: 'OK', data: account });
  mock2fa.enable2fa.mockResolvedValue({ success: false, message: "Couldn't sent email." });

  await renderSettings();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
  });

  expect(screen.getByText("Couldn't sent email.")).toBeInTheDocument();
});

test('a refused password change shows the server message', async () => {
  mockSettings.getSettings.mockResolvedValue({ success: true, message: 'OK', data: account });
  mockSettings.changeUserPassword.mockResolvedValue({ success: false, message: 'Old password is incorrect.' });

  await renderSettings();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
  });

  expect(screen.getByText('Old password is incorrect.')).toBeInTheDocument();
});
