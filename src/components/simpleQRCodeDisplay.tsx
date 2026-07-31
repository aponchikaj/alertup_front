import { useCallback, useEffect, useState } from 'react';
import { generateQRCode, downloadQRCodeAsFile, type QRCodeRequest } from '../apis/qrApi';
import { buildScanUrl, type Node } from '../apis/nodesApi';
import { sanitizeSvg } from '../lib/sanitizeSvg';
import { cn } from '../lib/cn';
import {
  buildPrintDocument,
  clampCopies,
  openPrintWindow,
  CARD_SIZE_MM,
  SHEET_CAPACITY,
  type PrintLayout,
} from '../lib/qrPrint';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Alert, Skeleton } from './ui/feedback';
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  FileTextIcon,
  LayersIcon,
  PrinterIcon,
  SmartphoneIcon,
} from './ui/icons';
import { useI18n } from '../i18n/LanguageProvider';

/* ============================================================================
   QR code dialog — preview, then print.
   ----------------------------------------------------------------------------
   The printed artefact is the actual product here: a code on a wall is how
   every visitor enters the system, and during an evacuation it may be the only
   thing within reach. So the preview is rendered at true physical scale — what
   you see is the size it comes out of the printer, because "looked fine on
   screen, unscannable on the wall" is the failure that matters.

   Layout geometry lives in lib/qrPrint.ts; this file is the chrome around it.
   ========================================================================= */

// Printed QR codes must keep resolving no matter where the app is served from,
// so the production origin is pinned here rather than taken from
// window.location — a code generated on localhost would otherwise be useless
// once it is on a wall.
const PUBLIC_ORIGIN = 'https://www.alertup.world';

/** Screen pixels per millimetre at the CSS reference of 96dpi. */
const PX_PER_MM = 96 / 25.4;

interface SimpleQRCodeDisplayProps {
  node: Node;
  buildingName?: string;
  floorName?: string;
  onClose: () => void;
}

interface QrResult {
  svgContent?: string | null;
  url?: string;
  filename?: string | null;
}

const LAYOUTS: { value: PrintLayout; labelKey: string; hintKey: string; Icon: typeof FileTextIcon }[] = [
  { value: 'card', labelKey: 'qr.layoutCard', hintKey: 'qr.layoutCardHint', Icon: SmartphoneIcon },
  { value: 'poster', labelKey: 'qr.layoutPoster', hintKey: 'qr.layoutPosterHint', Icon: FileTextIcon },
  { value: 'sheet', labelKey: 'qr.layoutSheet', hintKey: 'qr.layoutSheetHint', Icon: LayersIcon },
];

const SimpleQRCodeDisplay = ({
  node,
  buildingName,
  floorName,
  onClose,
}: SimpleQRCodeDisplayProps) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<QrResult | null>(null);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState<PrintLayout>('card');
  const [copies, setCopies] = useState(SHEET_CAPACITY);
  const [copied, setCopied] = useState(false);

  const scanUrl = buildScanUrl(node.buildingId, node.floorNumber, node._id, PUBLIC_ORIGIN);
  const locationLabel = node.label || t(`qr.node${node.type === 'exit' ? 'Exit' : 'Point'}`);
  const floorLabel = t('wayfinding.floor', { number: floorName || node.floorNumber || 1 });

  const generate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const request: QRCodeRequest = {
        nodeId: node._id,
        buildingId: node.buildingId,
        floorNumber: node.floorNumber,
        format: 'svg',
        customization: {
          // Literal hex, deliberately: a QR code has to stay maximum-contrast
          // black-on-white to scan reliably off a wall in poor light. This is a
          // functional requirement, not a style choice, so it does not follow
          // the theme tokens.
          primaryColor: '#000000',
          backgroundColor: '#FFFFFF',
          size: 'medium',
        },
      };
      const response = await generateQRCode(request);
      if (response.success && response.data) {
        setQrData(response.data as QrResult);
      } else {
        setError(response.message || t('qr.generateFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('qr.generateFailed'));
    } finally {
      setLoading(false);
    }
  }, [node._id, node.buildingId, node.floorNumber, t]);

  // Generated on open rather than behind a button: there is exactly one thing
  // to do in this dialog, and making the user ask for it first is a step that
  // buys nothing.
  useEffect(() => {
    void generate();
  }, [generate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    if (!qrData?.svgContent) {
      setError(t('qr.printNeedsSvg'));
      return;
    }
    const html = buildPrintDocument(
      {
        svgContent: qrData.svgContent,
        scanUrl,
        buildingName: buildingName || 'AlertUp',
        locationLabel,
        floorLabel,
      },
      {
        layout,
        copies,
        strings: {
          scanPrompt: t('qr.scanPrompt'),
          scanHint: t('qr.scanHint'),
          orVisit: t('qr.orVisit'),
          documentTitle: `${buildingName || 'AlertUp'} — ${locationLabel}`,
        },
      },
    );
    if (!openPrintWindow(html)) setError(t('qr.popupBlocked'));
  };

  const handleDownload = () => {
    if (!qrData?.filename) return;
    try {
      downloadQRCodeAsFile(qrData.filename, node.label || `${node.type}-node`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('qr.downloadFailed'));
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('qr.copyFailed'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-display-title"
    >
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto animate-scale-in">
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="qr-display-title" className="text-lg font-semibold text-ink sm:text-xl">
                {t('qr.title')}
              </h2>
              <p className="truncate text-sm text-ink-muted">
                {locationLabel} · {floorLabel}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.cancel')}>
              <CloseIcon size={20} />
            </Button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_16rem]">
            {/* Preview at true physical scale. */}
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink">{t('qr.preview')}</span>
                <span className="text-xs text-ink-subtle">{t('qr.actualSize')}</span>
              </div>

              <div className="flex min-h-56 items-center justify-center overflow-auto rounded-xl border border-line bg-surface-2 p-4">
                {loading ? (
                  <Skeleton className="h-44 w-72" />
                ) : qrData ? (
                  <PrintPreview
                    layout={layout}
                    svgContent={qrData.svgContent}
                    fallbackUrl={qrData.url}
                    buildingName={buildingName || 'AlertUp'}
                    locationLabel={locationLabel}
                    floorLabel={floorLabel}
                    scanUrl={scanUrl}
                    scanPrompt={t('qr.scanPrompt')}
                  />
                ) : null}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink">
                  {t('qr.printFormat')}
                </legend>
                {LAYOUTS.map(({ value, labelKey, hintKey, Icon }) => {
                  const active = layout === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setLayout(value)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-3 text-left',
                        'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        active
                          ? 'border-line-strong bg-surface-2'
                          : 'border-line hover:bg-surface-hover',
                      )}
                    >
                      <Icon size={18} className={active ? 'text-ink' : 'text-ink-muted'} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {t(labelKey)}
                        </span>
                        <span className="block text-xs text-ink-subtle">{t(hintKey)}</span>
                      </span>
                    </button>
                  );
                })}
              </fieldset>

              {layout === 'sheet' && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-ink">{t('qr.copies')}</span>
                  <input
                    type="number"
                    min={1}
                    max={SHEET_CAPACITY}
                    value={copies}
                    onChange={(e) => setCopies(clampCopies(Number(e.target.value)))}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink"
                  />
                  <span className="text-xs text-ink-subtle">
                    {t('qr.copiesHint', { max: SHEET_CAPACITY })}
                  </span>
                </label>
              )}

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <Button onClick={handlePrint} disabled={!qrData?.svgContent}>
                  <PrinterIcon size={18} />
                  {t('qr.print')}
                </Button>
                <Button variant="secondary" onClick={handleDownload} disabled={!qrData?.filename}>
                  <DownloadIcon size={18} />
                  {t('qr.download')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleCopyLink()}>
                  {copied ? (
                    <>
                      <CheckIcon size={16} className="text-success-text" />
                      {t('qr.copied')}
                    </>
                  ) : (
                    t('qr.copyLink')
                  )}
                </Button>
              </div>

              <p className="break-all font-mono text-[11px] leading-relaxed text-ink-subtle">
                {scanUrl}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * Preview rendered at true physical scale.
 *
 * Sized in millimetres converted at 96dpi, matching what the print stylesheet
 * emits, so the card on screen is the card that comes out of the printer.
 * The poster is shown at a third scale — A4 does not fit in a dialog — and
 * says so, rather than quietly lying about its size.
 */
const PrintPreview = ({
  layout,
  svgContent,
  fallbackUrl,
  buildingName,
  locationLabel,
  floorLabel,
  scanUrl,
  scanPrompt,
}: {
  layout: PrintLayout;
  svgContent?: string | null;
  fallbackUrl?: string;
  buildingName: string;
  locationLabel: string;
  floorLabel: string;
  scanUrl: string;
  scanPrompt: string;
}) => {
  const code = svgContent ? (
    <div
      className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgContent) }}
    />
  ) : fallbackUrl ? (
    <img src={fallbackUrl} alt="" className="h-full w-full" />
  ) : null;

  if (layout === 'poster') {
    // A4 at a third scale — the only honest way to show it in a dialog.
    const scale = 1 / 3;
    return (
      <div
        style={{
          width: 210 * PX_PER_MM * scale,
          height: 297 * PX_PER_MM * scale,
        }}
        className="flex flex-col items-center gap-2 rounded-sm bg-white p-4 text-center text-black shadow-md"
      >
        <div className="text-[13px] font-bold leading-tight">{buildingName}</div>
        <div className="text-[10px] font-semibold">{locationLabel}</div>
        <div className="text-[8px] text-neutral-600">{floorLabel}</div>
        <div className="mt-2" style={{ width: 110 * PX_PER_MM * scale, height: 110 * PX_PER_MM * scale }}>
          {code}
        </div>
        <div className="mt-2 text-[9px] font-bold">{scanPrompt}</div>
        <div className="mt-auto break-all font-mono text-[5px] text-neutral-500">{scanUrl}</div>
      </div>
    );
  }

  // Card, and one representative card for the sheet.
  return (
    <div
      style={{ width: CARD_SIZE_MM.width * PX_PER_MM, height: CARD_SIZE_MM.height * PX_PER_MM }}
      className="flex items-center gap-3 rounded-lg border-2 border-black bg-white p-3 text-black shadow-md"
    >
      <div style={{ width: 38 * PX_PER_MM, height: 38 * PX_PER_MM }} className="flex-none bg-white p-1">
        {code}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="truncate text-[13px] font-bold leading-tight">{buildingName}</div>
        <div className="truncate text-[11px] font-semibold">{locationLabel}</div>
        <div className="truncate text-[9px] text-neutral-600">{floorLabel}</div>
        <div className="mt-0.5 text-[10px] font-semibold">{scanPrompt}</div>
        <div className="mt-auto flex items-center gap-1 text-[7px] font-bold uppercase tracking-wide">
          <span className="h-1.5 w-1.5 rounded-full bg-black" />
          AlertUp
        </div>
      </div>
    </div>
  );
};

export default SimpleQRCodeDisplay;
