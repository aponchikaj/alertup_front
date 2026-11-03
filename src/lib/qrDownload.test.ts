import { qrDownloadName, downloadQrSvg } from './qrDownload';

/* FX-020 — the download button called GET /api/qr/download/:filename, a route
   the backend never had, so it always failed. The SVG is already on the page
   (the preview and the print sheet use it), so it is saved directly. */

test('names the file after the node', () => {
  expect(qrDownloadName('Main Lobby Exit')).toBe('alertup-qr-main-lobby-exit.svg');
});

test('strips characters a filename cannot carry', () => {
  expect(qrDownloadName('Café / Floor 2: "East"')).toBe('alertup-qr-caf-floor-2-east.svg');
});

test('falls back to a generic name', () => {
  expect(qrDownloadName('')).toBe('alertup-qr-code.svg');
});

test('saves the SVG markup as an image/svg+xml file', () => {
  const created: Blob[] = [];
  const click = jest.fn();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn((blob: Blob) => {
    created.push(blob);
    return 'blob:x';
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = jest.fn();
  const spy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);

  downloadQrSvg('<svg xmlns="http://www.w3.org/2000/svg"/>', 'Lobby');

  expect(created[0].type).toBe('image/svg+xml');
  expect(click).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');

  spy.mockRestore();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});
