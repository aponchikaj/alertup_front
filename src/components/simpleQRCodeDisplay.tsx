import { useState } from 'react';
import { generateQRCode, downloadQRCodeAsFile, type QRCodeRequest } from '../apis/qrApi';
import { type Node } from '../apis/nodesApi';

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
          primaryColor: '#000000',
          backgroundColor: '#FFFFFF',
          title: buildingName || 'Emergency Route',
          titleColor: '#FF7B22',
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
          <title>Emergency Route QR Code</title>
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
            .qr-title { 
              font-size: clamp(20px, 5vw, 32px); 
              font-weight: bold; 
              margin-bottom: 12px;
              color: #FF7B22;
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
              <div class="qr-title">${buildingName || 'Emergency Route'}</div>
              <div class="qr-subtitle">${node.label || node.type} - Floor ${floorName || '1'}</div>
            </div>
            
            <div class="qr-image">
              ${qrData.svgContent}
            </div>
            
            <div class="qr-info">
              <strong>Node Type:</strong> ${node.type}<br>
              <strong>Position:</strong> (${node.x}, ${node.y})<br>
              <strong>Scan for Emergency Route</strong><br>
              <strong>Building:</strong> ${buildingName || 'N/A'}
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
    printWindow.print();
    printWindow.close();
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#353535] rounded-lg max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-white">QR Code</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl sm:text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {/* Node Info */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="text-xs sm:text-sm text-gray-300">
              <div className="font-semibold text-white mb-1">
                {node.label || `${node.type} node`}
              </div>
              <div>Type: {node.type}</div>
              <div>Position: ({node.x}, {node.y})</div>
              <div>Floor: {floorName || '1'}</div>
            </div>
          </div>

          {/* Generate Button */}
          {!qrData && (
            <button
              onClick={generateQR}
              disabled={loading}
              className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-[#FF7B22] text-white rounded-lg font-medium hover:bg-[#FF7B22]/80 disabled:opacity-50 disabled:cursor-not-allowed mb-3 sm:mb-4 transition-colors text-sm sm:text-base"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-500/20 border border-red-500 text-red-300 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* QR Code Display */}
          {qrData && (
            <div className="space-y-3 sm:space-y-4">
              {/* Size Selection */}
              <div className="flex gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                <button
                  onClick={() => setPrintSize('poster')}
                  className={`flex-1 px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                    printSize === 'poster'
                      ? 'bg-[#FF7B22] text-white'
                      : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
                >
                  📄 Poster
                </button>
                <button
                  onClick={() => setPrintSize('card')}
                  className={`flex-1 px-2 sm:px-3 py-1 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                    printSize === 'card'
                      ? 'bg-[#FF7B22] text-white'
                      : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
                >
                  📱 Card
                </button>
              </div>

              {/* Emergency Route Link */}
              <div className="p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-xs sm:text-sm text-gray-300 mb-2">Emergency Route Link:</div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://www.alertup.world/scan/route/qr_${node.buildingId}_${node.floorNumber}_${node._id}`}
                    className="flex-1 px-2 sm:px-3 py-1 sm:py-2 bg-black/40 border border-white/20 rounded-lg text-white text-xs sm:text-sm font-mono"
                  />
                  <button
                    onClick={(event) => {
                      navigator.clipboard.writeText(`https://www.alertup.world/scan/route/qr_${node.buildingId}_${node.floorNumber}_${node._id}`);
                      // Show success feedback
                      const button = event?.target as HTMLButtonElement;
                      if (button) {
                        const originalText = button.textContent;
                        button.textContent = '✓ Copied!';
                        button.classList.add('bg-green-500');
                        setTimeout(() => {
                          button.textContent = originalText;
                          button.classList.remove('bg-green-500');
                        }, 2000);
                      }
                    }}
                    className="px-2 sm:px-3 py-1 sm:py-2 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 text-xs sm:text-sm transition-colors whitespace-nowrap"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="text-center">
                <div className="inline-block p-2 sm:p-4 bg-white rounded-lg border border-white/20">
                  {qrData.svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: qrData.svgContent }} />
                  ) : (
                    <img src={qrData.url} alt="QR Code" className="w-24 h-24 sm:w-32 sm:h-32" />
                  )}
                  <div className="mt-2 sm:mt-3">
                    <div className="font-bold text-xs sm:text-sm text-[#FF7B22]">
                      {buildingName || 'Emergency Route'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {node.label || node.type} - Floor {floorName || '1'}
                    </div>
                  </div>
                  <div className="mt-1 sm:mt-2 text-xs text-gray-500">
                    www.alertup.world
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={handleDownload}
                  className="px-3 sm:px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 font-medium transition-colors text-xs sm:text-sm"
                >
                  📱 Download
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors text-xs sm:text-sm"
                >
                  🖨️ Print {printSize === 'poster' ? 'Poster' : 'Card'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleQRCodeDisplay;
