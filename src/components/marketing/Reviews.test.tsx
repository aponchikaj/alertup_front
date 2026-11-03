import { act, fireEvent, render, screen } from '@testing-library/react';
import Reviews from './Reviews';
import * as reviewsApi from '../../apis/reviews';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';

/* FX-067 — the review card reads `success` to decide whether to show itself,
   and shows the server's `message` when a submission is refused. */

jest.mock('../../apis/reviews');
const mockReviews = reviewsApi as jest.Mocked<typeof reviewsApi>;

const renderCard = async () => {
  render(
    <LanguageProvider>
      <Reviews />
    </LanguageProvider>,
  );
  await act(async () => {});
};

beforeEach(() => jest.clearAllMocks());

test('stays hidden when the availability check fails', async () => {
  mockReviews.checkUserReviewAvailability.mockResolvedValue({ success: false, message: 'Sent' });

  await renderCard();

  expect(screen.queryByText(en.reviews.title)).not.toBeInTheDocument();
});

test('a refused submission shows the server message', async () => {
  mockReviews.checkUserReviewAvailability.mockResolvedValue({ success: true, message: 'Can' });
  mockReviews.sendFeedbackReview.mockResolvedValue({ success: false, message: 'Already sent.' });

  await renderCard();
  fireEvent.click(screen.getByRole('radio', { name: /Excellent/ }));
  fireEvent.click(screen.getByRole('button', { name: en.common.next }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }));
  });

  expect(screen.getByText('Already sent.')).toBeInTheDocument();
  expect(mockReviews.sendFeedbackReview).toHaveBeenCalledWith({ stars: 5, comment: '' });
});

test('an accepted submission thanks the user', async () => {
  mockReviews.checkUserReviewAvailability.mockResolvedValue({ success: true, message: 'Can' });
  mockReviews.sendFeedbackReview.mockResolvedValue({ success: true, message: 'Sent.' });

  await renderCard();
  fireEvent.click(screen.getByRole('radio', { name: /Good/ }));
  fireEvent.click(screen.getByRole('button', { name: en.common.next }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: en.reviews.submit }));
  });

  expect(screen.getByText(en.reviews.thankYouTitle)).toBeInTheDocument();
});
