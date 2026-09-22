import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { cn } from "../../lib/cn";
import { Alert } from "../ui/feedback";
import { ScanIcon } from "../ui/icons";
import { useI18n } from "../../i18n/LanguageProvider";

type ScannerProps = {
  /** Shows the AlertUp mark above the frame. */
  brandMark?: boolean;
  w?: number;
  h?: number;
  onScan: (data: string) => void;
  className?: string;
};

const Scanner = ({
  brandMark = false,
  w = 300,
  h = 300,
  onScan,
  className,
}: ScannerProps) => {
  const { t } = useI18n();
  const [startScanning, setStartScanning] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  // Unique per instance: both home.tsx and scan.tsx mount a mobile and a
  // desktop Scanner at once, and Html5Qrcode resolves its container by id, so a
  // hardcoded id would let one instance render into the other's element.
  const readerId = useId().replace(/:/g, "");

  // Held in a ref so the start/stop effect does not depend on it. Every call
  // site passes a fresh inline arrow, so listing onScan in the dependency array
  // tore the camera down and restarted it on each parent re-render.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Same reason as onScanRef: `t` changes identity when the language changes,
  // and listing it below would tear the camera down mid-scan.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!startScanning) return;

    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;
    // Tracks teardown that happens while start() is still pending.
    let cancelled = false;

    const config = {
      fps: 10,
      qrbox: { width: Math.min(w, 300), height: Math.min(h, 300) },
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    };

    const startPromise = scanner
      .start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (!isRunningRef.current) return;
          isRunningRef.current = false;
          onScanRef.current(decodedText);
          scanner.stop().then(() => setStartScanning(false)).catch(() => {});
        },
        (err) => {
          console.warn("QR scan error:", err);
        },
      )
      .then(() => {
        // If the component unmounted while the browser was still acquiring the
        // camera, cleanup already ran and saw isRunningRef false — so stop it
        // here instead, or the camera stays on with nobody left to turn it off.
        if (cancelled) {
          scanner.stop().catch(() => {});
          return;
        }
        isRunningRef.current = true;
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Cannot start camera:", err);
        setError(tRef.current("scan.cameraError"));
        setStartScanning(false);
      });

    return () => {
      cancelled = true;
      isRunningRef.current = false;
      // Chained off the start promise so teardown waits for start() to settle
      // rather than racing it.
      startPromise.then(() => scanner.stop().catch(() => {})).catch(() => {});
    };
  }, [startScanning, w, h, readerId]);

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      {error && (
        <Alert tone="warning" className="max-w-sm">
          {error}
        </Alert>
      )}

      {!startScanning ? (
        <button
          type="button"
          onClick={() => setStartScanning(true)}
          style={{ width: w, height: h }}
          className={cn(
            "group relative grid place-items-center overflow-hidden rounded-3xl",
            "border-2 border-dashed border-brand-border bg-surface-2",
            "transition-[border-color,background-color,transform] duration-200 ease-out",
            "hover:-translate-y-0.5 hover:border-brand hover:bg-brand-subtle",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
            "max-w-full",
          )}
        >
          <span className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-brand text-brand-ink">
              {/* Pulse hints that the control is live without animating layout. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-brand animate-pulse-ring"
              />
              <ScanIcon size={28} className="relative" />
            </span>
            <span className="text-base font-semibold text-ink">
              {t("scan.tapToScan")}
            </span>
            <span className="max-w-[15rem] text-sm text-ink-muted">
              {brandMark ? t("scan.cameraPrompt") : t("scan.cameraHint")}
            </span>
          </span>
        </button>
      ) : (
        <div
          id={readerId}
          style={{ width: w, height: h }}
          className="relative max-w-full overflow-hidden rounded-3xl border-2 border-brand bg-neutral-950"
        >
          <style>
            {`#${readerId} video { width: 100% !important; height: 100% !important; object-fit: cover; }`}
          </style>
        </div>
      )}
    </div>
  );
};

export default Scanner;
