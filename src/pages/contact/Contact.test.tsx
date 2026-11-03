import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Contact from './Contact';
import * as contactApi from '../../apis/contact';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';

/* FX-067 — a refused contact message shows the server's `message`. */

jest.mock('../../apis/contact');
jest.mock('../../seo/Seo', () => ({ __esModule: true, default: () => null }));
const mockContact = contactApi as jest.Mocked<typeof contactApi>;

const submit = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: en.common.send }).closest('form')!);
  });
};

test('a refusal shows the server message', async () => {
  mockContact.ContactAPI.mockResolvedValue({ success: false, message: 'Invalid email.' });

  await submit();

  expect(screen.getByRole('alert')).toHaveTextContent('Invalid email.');
});

test('a success shows the sent confirmation', async () => {
  mockContact.ContactAPI.mockResolvedValue({ success: true, message: 'Sent.' });

  await submit();

  expect(screen.getByText(en.contact.sent)).toBeInTheDocument();
});
