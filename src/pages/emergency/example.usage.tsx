// Example usage of EmergencyMap component in a page

import React, { useState } from 'react';
import EmergencyMap from '../components/emergencyMap';
import QRScanner from '../components/scanner'; // Your existing scanner component

const EmergencyExitPage: React.FC = () => {
  const [scannedQRId, setScannedQRId] = useState<string | null>(null);

  const handleQRScanned = (qrData: string) => {
    setScannedQRId(qrData);
  };

  const handleStartOver = () => {
    setScannedQRId(null);
  };

  return (
    <div className="emergency-exit-page">
      <header className="page-header">
        <h1>Emergency Exit Finder</h1>
        <p>Scan a QR code to find the nearest emergency exit</p>
      </header>

      {!scannedQRId ? (
        <div className="scanner-section">
          <QRScanner onScan={handleQRScanned} />
        </div>
      ) : (
        <div className="route-section">
          <EmergencyMap qrId={scannedQRId} />
          <button onClick={handleStartOver} className="btn-start-over">
            Scan Another QR Code
          </button>
        </div>
      )}
    </div>
  );
};

export default EmergencyExitPage;
