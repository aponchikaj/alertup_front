import { escapeHtml } from './escapeHtml';
import { sanitizeSvg } from './sanitizeSvg';

/* ============================================================================
   Printable QR documents.
   ----------------------------------------------------------------------------
   These end up stuck to walls and doors in real buildings, sometimes the only
   thing a person can reach during an evacuation. So the rules here are
   physical, not decorative:

     - Sizes are in millimetres and `@page` is set explicitly. The old sheet
       printed a 25mm code whatever size you picked, because the poster/card
       toggle only changed a label.
     - The code stays pure #000 on #fff with its quiet zone intact. Contrast is
       a scanning requirement in poor light, so it never follows the theme.
     - Nothing is placed over or inside the code, and it never scales below
       ~25mm — under that, phone cameras start failing at arm's length.
     - The payload is printed as text under the code. If the code is damaged or
       the camera fails, a person can still type the address.

   Kept out of the React component so the layout can be unit-tested without a
   browser, and so a print window is never opened just to check the markup.
   ========================================================================= */

export type PrintLayout = 'card' | 'poster' | 'sheet';

export interface QrPrintDetails {
  /** Sanitized <svg> markup of the code itself, with no baked-in text. */
  svgContent: string;
  /** The URL encoded in the code, printed as a fallback line. */
  scanUrl: string;
  buildingName: string;
  /** Where this specific code is stuck: "Main entrance", "Lift lobby". */
  locationLabel: string;
  floorLabel: string;
}

export interface PrintOptions {
  layout: PrintLayout;
  /** Copies for the `sheet` layout. Ignored by the others. */
  copies?: number;
  /** Localized strings, so the printed sheet matches the app's language. */
  strings: PrintStrings;
}

export interface PrintStrings {
  /** Call to action under the code, e.g. "Scan for directions". */
  scanPrompt: string;
  /** Second line, e.g. "Find your way, or the nearest exit in an emergency." */
  scanHint: string;
  /** Fallback line label, e.g. "Or visit". */
  orVisit: string;
  documentTitle: string;
}

/** ISO/IEC 7810 ID-1 — the credit-card size every wallet and badge holder fits. */
export const CARD_SIZE_MM = { width: 85.6, height: 54 } as const;

/** Cards per A4 sheet: 2 across, 5 down, with room for cut guides. */
export const SHEET_GRID = { columns: 2, rows: 5 } as const;
export const SHEET_CAPACITY = SHEET_GRID.columns * SHEET_GRID.rows;

/** Below roughly this, phone cameras start missing the code at arm's length. */
export const MIN_QR_MM = 25;

/**
 * Shared print stylesheet.
 *
 * `print-color-adjust: exact` matters more than it looks: browsers "helpfully"
 * drop backgrounds when printing, which would turn the code's white quiet zone
 * into paper-coloured nothing on tinted stock.
 */
const baseStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
    font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .qr svg, .qr img { display: block; width: 100%; height: 100%; }
  .qr {
    background: #ffffff;
    /* The quiet zone is part of the symbol; padding guarantees it survives
       even if the generator trimmed its own margin. */
    padding: 2mm;
    flex: none;
  }
  .name { font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; }
  .location { font-weight: 600; line-height: 1.2; }
  .muted { color: #4a4a4a; }
  .subtle { color: #6b6b6b; }
  .url {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
    color: #6b6b6b;
  }
  .brand {
    display: flex; align-items: center; gap: 1.5mm;
    font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
  }
  .brand-dot { background: #111111; border-radius: 50%; flex: none; }
`;

const cardStyles = `
  @page { size: ${CARD_SIZE_MM.width}mm ${CARD_SIZE_MM.height}mm; margin: 0; }
  body { width: ${CARD_SIZE_MM.width}mm; height: ${CARD_SIZE_MM.height}mm; }
  .card {
    width: 100%; height: 100%;
    display: flex; align-items: center; gap: 4mm;
    padding: 4mm 4.5mm;
    border: 0.4mm solid #111111;
    border-radius: 3mm;
  }
  .qr { width: 38mm; height: 38mm; }
  .card-body { min-width: 0; display: flex; flex-direction: column; gap: 1.2mm; }
  .card .name { font-size: 10.5pt; }
  .card .location { font-size: 9pt; }
  .card .floor { font-size: 7.5pt; }
  .card .prompt { font-size: 8pt; font-weight: 600; margin-top: 0.8mm; }
  .card .hint { font-size: 6.5pt; line-height: 1.3; }
  .card .url { font-size: 5.5pt; }
  .card .brand { font-size: 6pt; margin-top: auto; }
  .card .brand-dot { width: 1.6mm; height: 1.6mm; }
`;

const posterStyles = `
  @page { size: A4 portrait; margin: 12mm; }
  .poster {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    min-height: 250mm;
  }
  .poster .name { font-size: 30pt; margin-bottom: 3mm; }
  .poster .location { font-size: 20pt; margin-bottom: 1.5mm; }
  .poster .floor { font-size: 13pt; margin-bottom: 10mm; }
  .qr { width: 110mm; height: 110mm; border: 0.5mm solid #e2e2e2; border-radius: 3mm; }
  .poster .prompt { font-size: 17pt; font-weight: 700; margin-top: 10mm; }
  .poster .hint { font-size: 12pt; margin-top: 2.5mm; max-width: 130mm; line-height: 1.45; }
  .poster .fallback { margin-top: auto; padding-top: 12mm; }
  .poster .url { font-size: 9pt; }
  .poster .or-visit { font-size: 8pt; margin-bottom: 1mm; }
  .poster .brand { font-size: 9pt; justify-content: center; margin-top: 6mm; }
  .poster .brand-dot { width: 2.4mm; height: 2.4mm; }
`;

const sheetStyles = `
  @page { size: A4 portrait; margin: 8mm; }
  .sheet {
    display: grid;
    grid-template-columns: repeat(${SHEET_GRID.columns}, ${CARD_SIZE_MM.width}mm);
    gap: 4mm;
    justify-content: center;
  }
  .cut {
    /* Dashed guide sits outside the card border so scissors follow the guide,
       not the card's own edge. */
    padding: 1mm;
    border: 0.2mm dashed #b8b8b8;
    border-radius: 4mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .card {
    width: ${CARD_SIZE_MM.width}mm; height: ${CARD_SIZE_MM.height}mm;
    display: flex; align-items: center; gap: 3.5mm;
    padding: 3.5mm 4mm;
    border: 0.4mm solid #111111;
    border-radius: 3mm;
  }
  .qr { width: 34mm; height: 34mm; }
  .card-body { min-width: 0; display: flex; flex-direction: column; gap: 1mm; }
  .card .name { font-size: 9.5pt; }
  .card .location { font-size: 8pt; }
  .card .floor { font-size: 7pt; }
  .card .prompt { font-size: 7.5pt; font-weight: 600; margin-top: 0.6mm; }
  .card .url { font-size: 5pt; }
  .card .brand { font-size: 5.5pt; margin-top: auto; }
  .card .brand-dot { width: 1.4mm; height: 1.4mm; }
`;

const STYLES: Record<PrintLayout, string> = {
  card: cardStyles,
  poster: posterStyles,
  sheet: sheetStyles,
};

/** One card face. Used by both the single card and the tiled sheet. */
const cardMarkup = (details: QrPrintDetails, strings: PrintStrings, qr: string): string => `
  <div class="card">
    <div class="qr">${qr}</div>
    <div class="card-body">
      <div class="name">${escapeHtml(details.buildingName)}</div>
      <div class="location">${escapeHtml(details.locationLabel)}</div>
      <div class="floor muted">${escapeHtml(details.floorLabel)}</div>
      <div class="prompt">${escapeHtml(strings.scanPrompt)}</div>
      <div class="url">${escapeHtml(details.scanUrl)}</div>
      <div class="brand"><span class="brand-dot"></span>AlertUp</div>
    </div>
  </div>
`;

const posterMarkup = (details: QrPrintDetails, strings: PrintStrings, qr: string): string => `
  <div class="poster">
    <div class="name">${escapeHtml(details.buildingName)}</div>
    <div class="location">${escapeHtml(details.locationLabel)}</div>
    <div class="floor muted">${escapeHtml(details.floorLabel)}</div>
    <div class="qr">${qr}</div>
    <div class="prompt">${escapeHtml(strings.scanPrompt)}</div>
    <div class="hint muted">${escapeHtml(strings.scanHint)}</div>
    <div class="fallback">
      <div class="or-visit subtle">${escapeHtml(strings.orVisit)}</div>
      <div class="url">${escapeHtml(details.scanUrl)}</div>
      <div class="brand"><span class="brand-dot"></span>AlertUp</div>
    </div>
  </div>
`;

/** Copies clamped to what actually fits, so a stray number cannot spew pages. */
export const clampCopies = (copies: number | undefined): number => {
  const n = Math.floor(Number(copies));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, SHEET_CAPACITY);
};

/**
 * Build the complete print document.
 *
 * The QR markup is sanitized here rather than at the call site: this string is
 * written straight into a new window, so it is the last place the server's
 * response can be filtered.
 */
export const buildPrintDocument = (
  details: QrPrintDetails,
  { layout, copies, strings }: PrintOptions,
): string => {
  const qr = sanitizeSvg(details.svgContent);

  let body: string;
  if (layout === 'poster') {
    body = posterMarkup(details, strings, qr);
  } else if (layout === 'sheet') {
    const one = cardMarkup(details, strings, qr);
    body = `<div class="sheet">${Array.from(
      { length: clampCopies(copies) },
      () => `<div class="cut">${one}</div>`,
    ).join('')}</div>`;
  } else {
    body = cardMarkup(details, strings, qr);
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(strings.documentTitle)}</title>
    <style>${baseStyles}${STYLES[layout]}</style>
  </head>
  <body>${body}</body>
</html>`;
};

/**
 * Open the document in a new window and print it.
 *
 * Waits for load before calling print — Safari prints a blank page if asked
 * while the SVG is still parsing — and closes afterwards so the user is not
 * left with a stray tab.
 *
 * @returns false when the popup was blocked, so the caller can say so.
 */
export const openPrintWindow = (html: string): boolean => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  const start = () => {
    printWindow.print();
  };

  if (printWindow.document.readyState === 'complete') {
    setTimeout(start, 250);
  } else {
    printWindow.addEventListener('load', () => setTimeout(start, 250), { once: true });
  }

  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
  return true;
};
