import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import FoxIcon from "../assets/images/fox.png";
import clickIcon from "../assets/images/click.png";

type ScannerProps = {
  foxIcon?: boolean;
  w?: number;
  h?: number;
  onScan: (data: string) => void;
};

const Scanner = ({ foxIcon = false, w = 300, h = 300, onScan }: ScannerProps) => {
  const [startScanning, setStartScanning] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);

  // Start scanning when user taps
  useEffect(() => {
    if (!startScanning) return;

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: Math.min(w, 300), height: Math.min(h, 300) },
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    };

    scanner
      .start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (!isRunningRef.current) return;

          onScan(decodedText);

          // Stop scanning only once
          isRunningRef.current = false;
          scanner.stop().then(() => setStartScanning(false));
        },
        (err) => {
          console.warn("QR scan error:", err);
        }
      )
      .then(() => {
        isRunningRef.current = true;
        setError("");
      })
      .catch((err) => {
        console.error("Cannot start camera:", err);
        setError(
          "Camera access denied or not supported. Please allow camera permission."
        );
        setStartScanning(false);
      });

    return () => {
      if (scannerRef.current && isRunningRef.current) {
        isRunningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [startScanning, onScan, w, h]);

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {foxIcon && <img src={FoxIcon} alt="foxIcon" className="w-[50px] mb-2" />}

      {error && (
        <p className="text-red-500 text-center mb-2">{error}</p>
      )}

      {!startScanning && (
        <div
          className="relative flex flex-col items-center justify-center border border-[#FF7B22] rounded-lg bg-black cursor-pointer w-[300px] h-[300px]"
          style={{ width: w, height: h }}
          onClick={() => setStartScanning(true)}
        >
          <img src={clickIcon} alt="click" className="w-[40px] mb-2" />
          <p className="text-white text-center text-sm">
            Tap to allow camera & start scanning
          </p>
        </div>
      )}

      {startScanning && (
        <div
          id="qr-reader"
          className="rounded-lg overflow-hidden border border-[#FF7B22] bg-black relative"
          style={{ width: w, height: h }}
        >
          {/* Ensure camera video fills container */}
          <style>
            {`
              #qr-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover;
              }
            `}
          </style>
        </div>
      )}
    </div>
  );
};

export default Scanner;
