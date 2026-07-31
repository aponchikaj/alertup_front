import { useState } from 'react';
import { generateQRCode, downloadQRCodeAsFile, type QRCodeRequest } from '../apis/qrApi';
import { buildScanUrl, type Node } from '../apis/nodesApi';
import { escapeHtml } from '../lib/escapeHtml';
import { sanitizeSvg } from '../lib/sanitizeSvg';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Alert } from './ui/feedback';
import { TextField } from './ui/field';
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  FileTextIcon,
  PrinterIcon,
  SmartphoneIcon,
} from './ui/icons';

// Printed QR codes must keep resolving no matter where the app is served from,
// so the production origin is pinned here rather than taken from
// window.location — a code generated on localhost would otherwise be useless
// once it is on a wall.
const PUBLIC_ORIGIN = 'https://www.alertup.world';

interface SimpleQRCodeDisplayProps {
  node: Node;
  buildingName?: string;
  floorName?: string;
  onClose: () => void;
}

const SimpleQRCodeDisplay = ({ node, buildingName, floorName, onClose }: SimpleQRCodeDisplayProps) => {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [error, setError] = useState('');
  const [printSize, setPrintSize] = useState<'poster' | 'card'>('poster');
  const [copied, setCopied] = useState(false);

  const generateQR = async () => {
    try {
      setLoading(true);
      setError('');

      const request: QRCodeRequest = {
        nodeId: node._id,
        buildingId: node.buildingId,
        floorNumber: node.floorNumber,
        format: 'svg',
        customization: {
          // Literal hex, deliberately: a QR code has to stay maximum-contrast
          // black-on-white to scan reliably off a wall in poor light. This is a
          // functional requirement, not a style choice, so it does not follow
          // the theme tokens. The surrounding text is monochrome ink.
          primaryColor: '#000000',
          backgroundColor: '#FFFFFF',
          title: buildingName || 'AlertUp',
          titleColor: '#111111',
          subtitle: node ? `${node.label || node.type} - Floor ${floorName || '1'}` : `Floor ${floorName || '1'}`,
          subtitleColor: '#353535',
          size: 'medium'
        }
      };

      const response = await generateQRCode(request);

      if (response.success && response.data) {
        setQrData(response.data);
      } else {
        setError(response.message || 'Failed to generate QR code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!qrData?.svgContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Failed to open print window');
      return;
    }

    const isPoster = printSize === 'poster';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AlertUp QR code</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              background: #f5f5f5;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .qr-container {
              width: min(90%, 500px);
              max-width: 500px;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              text-align: center;
              margin: 0 auto;
            }
            .qr-header {
              margin-bottom: 30px;
            }
            /* The print window has no access to the app's design tokens, so the
               monochrome palette is spelled out literally here. */
            .qr-title {
              font-size: clamp(20px, 5vw, 32px);
              font-weight: bold;
              margin-bottom: 12px;
              color: #111111;
            }
            .qr-subtitle {
              font-size: clamp(14px, 3.5vw, 20px);
              margin-bottom: 25px;
              color: #353535;
            }
            .qr-image {
              margin: 30px 0;
            }
            .qr-image svg {
              width: clamp(120px, 25vw, 300px);
              height: clamp(120px, 25vw, 300px);
              max-width: 100%;
            }
            .qr-footer {
              margin-top: 30px;
              padding-top: 25px;
              border-top: 1px solid #eee;
              font-size: 14px;
              color: #666;
            }
            .qr-info {
              margin: 20px 0;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
              font-size: clamp(12px, 2.5vw, 16px);
              color: #333;
              line-height: 1.6;
            }
            .qr-size-indicator {
              position: absolute;
              top: 10px;
              right: 10px;
              font-size: 10px;
              color: #999;
              background: white;
              padding: 2px 6px;
              border-radius: 4px;
              border: 1px solid #ddd;
            }

            @media (max-width: 640px) {
              body {
                padding: 10px;
                font-size: 14px;
              }
              .qr-container {
                width: 100%;
                max-width: 350px;
                padding: 20px;
              }
              .qr-title {
                font-size: 24px !important;
                margin-bottom: 8px !important;
              }
              .qr-subtitle {
                font-size: 16px !important;
                margin-bottom: 15px !important;
              }
              .qr-image {
                margin: 15px 0 !important;
              }
              .qr-image svg {
                width: 180px !important;
                height: 180px !important;
              }
              .qr-footer {
                margin-top: 15px !important;
                padding-top: 15px !important;
                font-size: 12px !important;
              }
              .qr-info {
                margin: 10px 0 !important;
                padding: 10px !important;
                font-size: 12px !important;
              }
              .qr-size-indicator {
                font-size: 8px !important;
                padding: 1px 4px !important;
              }
            }

            @media (min-width: 641px) and (max-width: 1024px) {
              body {
                padding: 15px;
              }
              .qr-container {
                width: 90%;
                max-width: 450px;
              }
              .qr-image svg {
                width: 220px !important;
                height: 220px !important;
              }
            }

            @media print {
              body {
                background: white;
                padding: 5mm;
                font-size: 12pt;
              }
              .qr-container {
                box-shadow: none;
                margin: 0;
                width: 100%;
                max-width: none;
                page-break-inside: avoid;
              }
              .qr-image svg {
                width: 25mm !important;
                height: 25mm !important;
              }
              .qr-title {
                font-size: 16pt !important;
              }
              .qr-subtitle {
                font-size: 12pt !important;
              }
              .qr-info {
                font-size: 10pt !important;
              }
              .qr-footer {
                font-size: 9pt !important;
              }
              .qr-size-indicator {
                display: block;
                font-size: 8pt;
              }
              @page {
                margin: 10mm;
                size: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-size-indicator">${isPoster ? 'POSTER' : 'CARD'}</div>
            <div class="qr-header">
              <div class="qr-title">${escapeHtml(buildingName || 'AlertUp')}</div>
              <div class="qr-subtitle">${escapeHtml(node.label || node.type)} - Floor ${escapeHtml(floorName || '1')}</div>
            </div>

            <div class="qr-image">
              ${sanitizeSvg(qrData.svgContent)}
            </div>

            <div class="qr-info">
              <strong>Node Type:</strong> ${escapeHtml(node.type)}<br>
              <strong>Position:</strong> (${Number(node.x)}, ${Number(node.y)})<br>
              <strong>Scan for directions — and the way out</strong><br>
              <strong>Building:</strong> ${escapeHtml(buildingName || 'N/A')}
            </div>

            <div class="qr-footer">
              www.alertup.world
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Printing is driven by the new window's own load/afterprint events.
    // Calling print() and close() synchronously after document.write raced the
    // layout on browsers that render asynchronously, producing blank or
    // truncated printouts and sometimes dismissing the dialog outright.
    const startPrint = () => {
      printWindow.print();
    };

    if (printWindow.document.readyState === 'complete') {
      startPrint();
    } else {
      printWindow.addEventListener('load', startPrint, { once: true });
    }

    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
  };

  const handleDownload = () => {
    if (!qrData?.filename) return;

    try {
      const nodeName = node.label || `${node.type}-node`;
      downloadQRCodeAsFile(qrData.filename, nodeName);
    } catch (err: any) {
      setError(err.message || 'Failed to download QR code');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(buildScanUrl(node.buildingId, node.floorNumber, node._id, PUBLIC_ORIGIN));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-display-title"
    >
      <Card className="max-h-[90vh] w-full max-w-md overflow-y-auto animate-scale-in">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between sm:mb-6">
            <h2 id="qr-display-title" className="text-lg font-semibold text-ink sm:text-xl">
              QR Code
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <CloseIcon size={20} />
            </Button>
          </div>

          {/* Node Info */}
          <div className="mb-4 rounded-xl border border-line bg-surface-2 p-3 sm:mb-6 sm:p-4">
            <div className="text-xs text-ink-muted sm:text-sm">
              <div className="mb-1 font-semibold text-ink">
                {node.label || `${node.type} node`}
              </div>
              <div>Type: {node.type}</div>
              <div>Position: ({node.x}, {node.y})</div>
              <div>Floor: {floorName || '1'}</div>
            </div>
          </div>

          {/* Generate Button */}
          {!qrData && (
            <Button
              fullWidth
              size="lg"
              className="mb-3 sm:mb-4"
              onClick={generateQR}
              loading={loading}
              loadingLabel="Generating..."
            >
              Generate QR Code
            </Button>
          )}

          {/* Error Display */}
          {error && (
            <Alert tone="danger" className="mb-3 sm:mb-4">
              {error}
            </Alert>
          )}

          {/* QR Code Display */}
          {qrData && (
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Size Selection */}
              <div
                role="group"
                aria-label="Print size"
                className="flex gap-2 rounded-xl border border-line bg-surface-2 p-2"
              >
                <Button
                  variant={printSize === 'poster' ? 'primary' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPrintSize('poster')}
                  aria-pressed={printSize === 'poster'}
                >
                  <FileTextIcon size={16} />
                  Poster
                </Button>
                <Button
                  variant={printSize === 'card' ? 'primary' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPrintSize('card')}
                  aria-pressed={printSize === 'card'}
                >
                  <SmartphoneIcon size={16} />
                  Card
                </Button>
              </div>

              {/* Emergency Route Link */}
              <div className="flex flex-col gap-2">
                <TextField
                  label="Scan link"
                  readOnly
                  value={buildScanUrl(node.buildingId, node.floorNumber, node._id, PUBLIC_ORIGIN)}
                  inputClassName="font-mono text-sm"
                />
                <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                  {copied ? (
                    <>
                      <CheckIcon size={16} className="text-success-text" />
                      Copied!
                    </>
                  ) : (
                    'Copy link'
                  )}
                </Button>
              </div>

              {/* Preview */}
              <div className="text-center">
                <div className="inline-block rounded-xl border border-line bg-surface p-2 shadow-sm sm:p-4">
                  {qrData.svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeSvg(qrData.svgContent) }} />
                  ) : (
                    <img src={qrData.url} alt="QR Code" className="h-24 w-24 sm:h-32 sm:w-32" />
                  )}
                  <div className="mt-2 sm:mt-3">
                    <div className="text-xs font-bold text-brand-text sm:text-sm">
                      {buildingName || 'AlertUp'}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {node.label || node.type} - Floor {floorName || '1'}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-ink-subtle sm:mt-2">
                    www.alertup.world
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Button variant="secondary" onClick={handleDownload}>
                  <DownloadIcon size={18} />
                  Download
                </Button>
                <Button onClick={handlePrint}>
                  <PrinterIcon size={18} />
                  Print {printSize === 'poster' ? 'Poster' : 'Card'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SimpleQRCodeDisplay;
