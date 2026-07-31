import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFloor } from "../../apis/building";
import { usePageAnimations } from "../../lib/animations";
import { escapeHtml } from "../../lib/escapeHtml";
import { PageHeader, PageShell } from "../../components/ui/layout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert, Skeleton } from "../../components/ui/feedback";
import { PrinterIcon } from "../../components/ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

interface FloorData {
  floor: string;
  map: string;
  qrCode: string;
  scanned: string[];
  createdAt: string;
}

interface ApiResponse {
  Success: boolean;
  Message: {
    buildingName: string;
    floorData: FloorData;
    scannedCount: number;
  };
}

const Floor = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const { id, floor } = useParams<{ id: string; floor: string }>();

  const [floorData, setFloorData] = useState<FloorData | null>(null);
  const [buildingName, setBuildingName] = useState("");
  const [scannedCount, setScannedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const fetchFloorData = async () => {
      try {
        const res: ApiResponse = await getFloor({ id: id!, floor: floor! });
        console.log("Floor API response:", res);

        if (!res ) {
          setServerError(t("common.error"));
          return;
        }

        // On an error response Message is a string, so reading .floorData off
        // it yielded undefined and every auth/404/network failure was reported
        // to the user as "Floor data not found".
        if (res.Success === false) {
          setServerError(
            typeof res.Message === "string"
              ? res.Message
              : t("buildings.floorLoadFailed"),
          );
          return;
        }

        const data = res.Message?.floorData;
        if (!data) {
          setServerError(t("buildings.floorLoadFailed"));
          return;
        }

        setFloorData(data);
        setBuildingName(res.Message.buildingName);
        setScannedCount(res.Message.scannedCount);
      } catch (err) {
        console.error(err);
        setServerError(t("common.error"));
      } finally {
        setLoading(false);
      }
    };

    fetchFloorData();
  }, [id, floor, t]);

  const handlePrintQRCode = (type: "poster" | "card" = "poster") => {
  if (!floorData) return;

  const w = window.open("", "PRINT", "width=900,height=1200");
  if (!w) return;

  const isCard = type === "card";

  // Everything interpolated below lands in a raw HTML string, so translated
  // copy is escaped exactly like the API-supplied names are.
  const scanFor = escapeHtml(t("buildings.printScanFor"));
  const subtitle = escapeHtml(t("buildings.printSubtitle"));
  const place = `${escapeHtml(buildingName)} — ${escapeHtml(floorData.floor)}`;

  w.document.write(`
    <html>
      <head>
        <title>${escapeHtml(t("buildings.printTitle"))}</title>
        <style>
          @page {
            size: ${isCard ? "90mm 55mm" : "A4"};
            margin: ${isCard ? "2mm" : "0"};
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
          }

          /* ================= CARD ================= */
          .card {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }

          .card-title {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 2mm;
          }

          .card-qr {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
          }

          .card-qr img {
            width: 100%;
            max-height: 85%;
            aspect-ratio: 1 / 1;
          }

          .card-footer {
            font-size: 8px;
            margin-bottom: 2mm;
            letter-spacing: 0.3px;
          }

          /* ================= POSTER ================= */
          .poster {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          /* The print document is a bare window with no access to the app's
             design tokens, so the monochrome palette is spelled out literally
             here. Ink on white — no brand colour on a printed artifact. */
          .header {
            background: #111111;
            color: #FFFFFF;
            padding: 40px;
            text-align: center;
          }

          .header h1 {
            margin: 0;
            font-size: 42px;
            text-transform: uppercase;
          }

          .header p {
            margin-top: 8px;
            font-size: 18px;
          }

          .content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .qr-box {
            border: 6px solid #111111;
            border-radius: 24px;
            padding: 40px;
            text-align: center;
          }

          .qr-box img {
            width: 300px;
            height: 300px;
          }

          .scan-text {
            margin-top: 20px;
            font-size: 20px;
            font-weight: bold;
          }

          .footer {
            background: #111;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
          }
        </style>
      </head>

      <body>
        ${
          isCard
            ? `
              <div class="card">
                <div class="card-title">${scanFor}</div>

                <div class="card-qr">
                  <img src="${floorData.qrCode}" />
                </div>

                <div class="card-footer">www.alertup.world</div>
              </div>
            `
            : `
              <div class="poster">
                <div class="header">
                  <h1>${scanFor}</h1>
                  <p>${subtitle}</p>
                </div>

                <div class="content">
                  <div class="qr-box">
                    <img src="${floorData.qrCode}" />
                    <div class="scan-text">${place}</div>
                  </div>
                </div>

                <div class="footer">www.alertup.world</div>
              </div>
            `
        }
      </body>
    </html>
  `);

  w.document.close();
  w.focus();

  // The QR is an <img>, so printing has to wait for it to load. Calling print()
  // and close() synchronously produced posters with a blank square where the
  // code should be.
  const startPrint = () => w.print();
  if (w.document.readyState === 'complete') {
    startPrint();
  } else {
    w.addEventListener('load', startPrint, { once: true });
  }
  w.addEventListener('afterprint', () => w.close(), { once: true });
};

  if (loading)
    return (
      <div ref={rootRef}>
        <PageShell width="wide">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-72 w-full" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <p className="sr-only" role="status">
              {t("common.loading")}
            </p>
          </div>
        </PageShell>
      </div>
    );

  if (serverError)
    return (
      <div ref={rootRef}>
        <PageShell width="wide">
          <Alert tone="danger">{serverError}</Alert>
        </PageShell>
      </div>
    );

  return (
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader
            title={
              <>
                {buildingName} <br /> {floorData?.floor}
              </>
            }
            description={t("buildings.floorLead")}
          />
        </div>

        <div data-reveal-group className="flex flex-col gap-6 pt-8">
          {/* Map Card */}
          <Card data-reveal-item className="flex flex-col items-center p-6">
            <h2 className="mb-4 text-xl font-semibold text-ink">
              {t("buildings.floorMap")}
            </h2>
            <img
              src={floorData?.map}
              alt={t("buildings.floorMapAlt", { floor: floorData?.floor ?? "" })}
              className="h-auto w-full rounded-xl border border-line object-cover shadow-md"
            />
          </Card>

          {/* Info Card */}
          <Card data-reveal-item className="p-6">
            <h2 className="mb-4 text-xl font-semibold text-ink">
              {t("buildings.floorTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Stat label={t("buildings.floorName")} value={floorData?.floor} />
              <Stat label={t("buildings.createdAt")} value={new Date(floorData?.createdAt || "").toLocaleString()} />
              <Stat label={t("buildings.scannedCount")} value={scannedCount} />
            </div>
          </Card>

          {/* QR Code Card */}
          <Card data-reveal-item className="flex flex-col items-center p-6">
            <h2 className="mb-4 text-xl font-semibold text-ink">
              {t("buildings.qrCode")}
            </h2>
            <img
              src={floorData?.qrCode}
              alt={t("buildings.qrCode")}
              className="mb-4 h-40 w-40 rounded-xl border border-line bg-surface p-2"
            />
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => handlePrintQRCode("poster")}>
                <PrinterIcon size={18} />
                {t("buildings.printPoster")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handlePrintQRCode("card")}
              >
                <PrinterIcon size={18} />
                {t("buildings.printCard")}
              </Button>
            </div>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div className="rounded-xl border border-line bg-surface-2 p-4 text-center">
    <p className="text-sm text-ink-subtle">{label}</p>
    <p className="text-2xl font-bold text-brand-text">{value}</p>
  </div>
);

export default Floor;
