import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFloor } from "../../apis/building";
import { usePageAnimations } from "../../lib/animations";
import {
  buildPrintDocument,
  openPrintWindow,
  SHEET_CAPACITY,
} from "../../lib/qrPrint";
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

  /**
   * Printing goes through the shared qrPrint module — the same real-world
   * page sizes, quiet-zone padding and typeable fallback URL as every node
   * QR. This replaced a page-local 170-line print document whose card size
   * drifted from the standard and whose QR had no quiet-zone guarantee.
   */
  const handlePrintQRCode = (layout: 'poster' | 'card' | 'sheet') => {
    if (!floorData) return;
    const html = buildPrintDocument(
      {
        imageUrl: floorData.qrCode,
        scanUrl: '',
        buildingName,
        locationLabel: floorData.floor,
        floorLabel: floorData.floor,
      },
      {
        layout,
        copies: SHEET_CAPACITY,
        strings: {
          scanPrompt: t('qr.scanPrompt'),
          scanHint: t('qr.scanHint'),
          orVisit: t('qr.orVisit'),
          documentTitle: `${buildingName} — ${floorData.floor}`,
        },
      },
    );
    if (!openPrintWindow(html)) setServerError(t('qr.popupBlocked'));
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
              <Button
                variant="secondary"
                onClick={() => handlePrintQRCode("sheet")}
              >
                <PrinterIcon size={18} />
                {t("qr.layoutSheet")}
              </Button>
            </div>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number | undefined }) => (
  <div className="rounded-xl border border-line bg-surface-2 p-4 text-center">
    <p className="text-sm text-ink-subtle">{label}</p>
    <p className="text-2xl font-bold text-brand-text">{value}</p>
  </div>
);

export default Floor;
