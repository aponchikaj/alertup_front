import {
  buildPrintDocument,
  clampCopies,
  CARD_SIZE_MM,
  SHEET_CAPACITY,
  type QrPrintDetails,
  type PrintStrings,
} from './qrPrint';

/* These sheets get stuck to walls, so the assertions are about physical
   correctness — real page sizes, an intact quiet zone, a typeable fallback —
   rather than markup shape. */

const details: QrPrintDetails = {
  svgContent: '<svg viewBox="0 0 100 100"><rect width="100" height="100" /></svg>',
  scanUrl: 'https://www.alertup.world/scan/route/qr_b1_1_n1',
  buildingName: 'Tbilisi Mall',
  locationLabel: 'Main entrance',
  floorLabel: 'Ground floor',
};

const strings: PrintStrings = {
  scanPrompt: 'Scan for directions',
  scanHint: 'Find your way, or the nearest exit in an emergency.',
  orVisit: 'Or visit',
  documentTitle: 'AlertUp QR code',
};

const build = (layout: 'card' | 'poster' | 'sheet', copies?: number) =>
  buildPrintDocument(details, { layout, copies, strings });

describe('buildPrintDocument', () => {
  it('sets a real card page size rather than leaving it to the printer', () => {
    const html = build('card');
    expect(html).toContain(`size: ${CARD_SIZE_MM.width}mm ${CARD_SIZE_MM.height}mm`);
    expect(html).toContain('margin: 0');
  });

  it('prints the poster on A4', () => {
    expect(build('poster')).toContain('size: A4 portrait');
  });

  it('gives the card and poster genuinely different code sizes', () => {
    // The old sheet printed 25mm whatever you picked; the toggle only changed
    // a label. These must not converge again.
    expect(build('card')).toContain('.qr { width: 38mm; height: 38mm; }');
    expect(build('poster')).toContain('width: 110mm; height: 110mm');
  });

  it('keeps the quiet zone and forces backgrounds to print', () => {
    const html = build('card');
    expect(html).toContain('padding: 2mm');
    expect(html).toContain('print-color-adjust: exact');
  });

  it('always includes the URL, so a damaged code can still be typed', () => {
    for (const layout of ['card', 'poster', 'sheet'] as const) {
      expect(build(layout)).toContain(details.scanUrl);
    }
  });

  it('escapes text that came from user input', () => {
    const html = buildPrintDocument(
      { ...details, buildingName: '<script>alert(1)</script>' },
      { layout: 'card', strings },
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sanitizes the QR markup on its way into the new window', () => {
    const html = buildPrintDocument(
      { ...details, svgContent: '<svg onload="alert(1)"><rect /></svg>' },
      { layout: 'card', strings },
    );
    expect(html).not.toContain('onload');
  });

  it('tiles the requested number of cards with cut guides', () => {
    const html = build('sheet', 6);
    expect(html.match(/class="cut"/g)).toHaveLength(6);
    expect(html).toContain('dashed');
    // Cards must not be split across a page break.
    expect(html).toContain('break-inside: avoid');
  });

  it('renders one card per page for the single-card layout', () => {
    expect(build('card').match(/class="card"/g)).toHaveLength(1);
  });
});

describe('clampCopies', () => {
  it('defaults junk to a single copy', () => {
    for (const value of [undefined, 0, -3, NaN]) {
      expect(clampCopies(value as number)).toBe(1);
    }
  });

  it('caps at what fits on one sheet, so a typo cannot spew pages', () => {
    expect(clampCopies(999)).toBe(SHEET_CAPACITY);
    expect(clampCopies(4)).toBe(4);
  });
});
