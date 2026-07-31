import DOMPurify from "dompurify";

/**
 * Sanitize floor-plan SVG markup before injecting it into the page.
 *
 * Floor maps are uploaded by building owners and served back to every visitor,
 * including on the unauthenticated QR-scan route page. Injecting that markup
 * raw meant an uploaded SVG carrying <script> or an onload handler executed in
 * the browser of anyone who scanned the code.
 */
export const sanitizeSvg = (svg: string | null | undefined): string => {
  if (!svg) return "";

  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Blocks <foreignObject>, which can smuggle HTML (and scripts) into an
    // otherwise SVG-only document.
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["onload", "onerror", "onclick"],
  });
};

export default sanitizeSvg;
