import { readFileSync } from 'fs';
import { join } from 'path';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { AuthProvider } from '../../auth/AuthProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { en } from '../../i18n/messages/en';
import Navbar from './Navbar';

/* ============================================================================
   The skip link vs. the global anchor colour rule (F15 item 5, round 2).
   ----------------------------------------------------------------------------
   Same defect as button.test.tsx, on the one place in the app that builds its
   classes from `buttonStyles` directly instead of going through `ButtonLink`:
   `typography.css`'s `a:not([data-button])` (0,1,1) used to beat the
   `text-accent-ink` utility (0,1,0) `buttonStyles({variant:"primary"})` puts
   on this anchor, leaving button-blue text on its own button-blue fill.

   Jest never loads real stylesheets (see jest.config.js), so this cannot
   measure the rendered colour the way a browser does — it asserts the
   mechanism instead: the exclusion selector must not match this anchor.
   ========================================================================= */

jest.mock('../../apis/me', () => ({
  getAuthState: jest.fn().mockResolvedValue({ state: 'unauthenticated' }),
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const typographyCss = readFileSync(
  join(__dirname, '../../styles/typography.css'),
  'utf8',
);

const anchorRuleSelector = (() => {
  const match = /a:not\(\[data-button\]\)/.exec(typographyCss);
  if (!match) {
    throw new Error(
      'typography.css no longer has an `a:not([data-button])` rule — update this test to match whatever replaced it.',
    );
  }
  return match[0];
})();

const renderNavbar = async () => {
  let result!: ReturnType<typeof render>;
  // The mocked getAuthState() resolves on the microtask queue right after
  // mount; flushing it inside `act` here keeps the assertions below free of
  // React's "update not wrapped in act" noise — irrelevant to what this test
  // pins, but worth keeping the suite's output clean.
  await act(async () => {
    result = render(
      <MemoryRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <Navbar />
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  return result;
};

describe('Navbar skip link', () => {
  it('carries data-button, so the global anchor colour rule cannot touch it', async () => {
    await renderNavbar();

    const skipLink = screen.getByRole('link', { name: en.nav.skipToContent });
    // This is the assertion that would have failed before the fix: without
    // `data-button`, this selector matches the skip link and its (0,1,1)
    // `color` beats the (0,1,0) `text-accent-ink` utility from buttonStyles.
    expect(skipLink.matches(anchorRuleSelector)).toBe(false);
  });
});
