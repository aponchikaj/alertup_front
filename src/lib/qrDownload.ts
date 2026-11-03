/**
 * Save a QR code as an SVG file (FX-020).
 *
 * The markup is already in the browser — it is what the preview and the
 * print sheet render — so the download needs no server round-trip.
 */
export function qrDownloadName(nodeName: string): string {
  const slug = nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `alertup-qr-${slug || 'code'}.svg`;
}

export function downloadQrSvg(svgContent: string, nodeName: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = qrDownloadName(nodeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
