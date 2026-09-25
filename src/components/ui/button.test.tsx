import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ButtonLink } from './button';

/* ============================================================================
   ButtonLink vs. the global anchor colour rule (F15 item 5, round 2).
   ----------------------------------------------------------------------------
   `typography.css` sets `a:not([data-button]) { color: var(--accent-text) }`
   at specificity (0,1,1) — higher than the `text-accent-ink` utility class
   (0,1,0) that `buttonStyles` puts on every button-styled anchor. Jest never
   loads real stylesheets (see jest.config.js's CSS moduleNameMapper), so no
   rendered-DOM test here can measure the ACTUAL computed colour the way a
   browser would; a token-ratio test (tokens.contrast.test.ts) is blind to
   this class of bug entirely, because it never looks at which selector wins.
   What jsdom CAN do is CSS selector matching (`Element.matches`), so these
   tests assert the mechanism the fix actually relies on: the exclusion
   selector must stop matching `ButtonLink`'s anchor once `data-button` is
   present. A real browser/contrast measurement still belongs in the F15
   report, not here.
   ========================================================================= */

const typographyCss = readFileSync(
  join(__dirname, '../../styles/typography.css'),
  'utf8',
);

/** Read from the source rather than hardcoded a second time, so a future
 *  rewording of the rule can't silently turn this test into a no-op. */
const anchorRuleSelector = (() => {
  const match = /a:not\(\[data-button\]\)/.exec(typographyCss);
  if (!match) {
    throw new Error(
      'typography.css no longer has an `a:not([data-button])` rule — update this test to match whatever replaced it.',
    );
  }
  return match[0];
})();

describe('the global anchor colour rule is real and gated on [data-button]', () => {
  it('matches a plain anchor with no data-button attribute', () => {
    const plain = document.createElement('a');
    document.body.appendChild(plain);
    expect(plain.matches(anchorRuleSelector)).toBe(true);
    plain.remove();
  });

  it('does NOT match an anchor carrying data-button', () => {
    const buttonish = document.createElement('a');
    buttonish.setAttribute('data-button', '');
    document.body.appendChild(buttonish);
    expect(buttonish.matches(anchorRuleSelector)).toBe(false);
    buttonish.remove();
  });
});

describe('ButtonLink renders an anchor the global anchor colour rule cannot touch', () => {
  it('carries data-button, so buttonStyles owns its colour uncontested', () => {
    const { container } = render(
      <MemoryRouter>
        <ButtonLink to="/somewhere" variant="primary">
          Go
        </ButtonLink>
      </MemoryRouter>,
    );

    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    // This is the assertion that would have failed before the fix: without
    // `data-button`, `a:not([data-button])` matches every ButtonLink anchor
    // in the app, and its (0,1,1) `color` beats the (0,1,0) `text-accent-ink`
    // utility `buttonStyles` puts on the same element.
    expect(anchor!.matches(anchorRuleSelector)).toBe(false);
  });
});
