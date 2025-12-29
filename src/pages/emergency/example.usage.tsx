// Example usage of EmergencyMap component in a page

import React, { useState } from 'react';

const EmergencyExitPage: React.FC = () => {
  const [scannedQRId, setScannedQRId] = useState<string | null>(null);

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
        </div>
      ) : (
        <div className="route-section">
          <button onClick={handleStartOver} className="btn-start-over">
            Scan Another QR Code
          </button>
        </div>
      )}
    </div>
  );
};

export default EmergencyExitPage;
