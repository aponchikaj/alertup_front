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
    const qrSize = isPoster ? '300px' : '200px';
    const titleSize = isPoster ? '32px' : '24px';
    const subtitleSize = isPoster ? '20px' : '16px';
    const infoSize = isPoster ? '16px' : '14px';
    const containerWidth = isPoster ? '500px' : '350px';
    const padding = isPoster ? '40px' : '25px';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Emergency Route QR Code</title>
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
              width: ${containerWidth};
              background: white;
              padding: ${padding};
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              text-align: center;
            }
            .qr-header {
              margin-bottom: ${isPoster ? '30px' : '20px'};
            }
            .qr-title { 
              font-size: ${titleSize}; 
              font-weight: bold; 
              margin-bottom: ${isPoster ? '12px' : '8px'};
              color: #FF7B22;
            }
            .qr-subtitle { 
              font-size: ${subtitleSize}; 
              margin-bottom: ${isPoster ? '25px' : '20px'};
              color: #353535;
            }
            .qr-image { 
              margin: ${isPoster ? '30px' : '20px'} 0;
            }
            .qr-image svg {
              width: ${qrSize};
              height: ${qrSize};
            }
            .qr-footer { 
              margin-top: ${isPoster ? '30px' : '20px'};
              padding-top: ${isPoster ? '25px' : '20px'};
              border-top: 1px solid #eee;
              font-size: ${isPoster ? '14px' : '12px'}; 
              color: #666;
            }
            .qr-info {
              margin: ${isPoster ? '20px' : '15px'} 0;
              padding: ${isPoster ? '15px' : '10px'};
              background: #f8f9fa;
              border-radius: 8px;
              font-size: ${infoSize};
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
            @media print {
              body { 
                background: white;
                padding: 10px;
              }
              .qr-container { 
                box-shadow: none;
                margin: 0;
                width: ${isPoster ? '100%' : '350px'};
              }
              .qr-size-indicator {
                display: block;
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
      <div className="bg-[#353535] rounded-lg max-w-md w-full border border-white/10">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">QR Code</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {/* Node Info */}
          <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="text-sm text-gray-300">
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
              className="w-full px-6 py-3 bg-[#FF7B22] text-white rounded-lg font-medium hover:bg-[#FF7B22]/80 disabled:opacity-50 disabled:cursor-not-allowed mb-4 transition-colors"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 rounded-lg">
              {error}
            </div>
          )}

          {/* QR Code Display */}
          {qrData && (
            <div className="space-y-4">
              {/* Size Selection */}
              <div className="flex gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                <button
                  onClick={() => setPrintSize('poster')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                    printSize === 'poster'
                      ? 'bg-[#FF7B22] text-white'
                      : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
                >
                  📄 Poster
                </button>
                <button
                  onClick={() => setPrintSize('card')}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                    printSize === 'card'
                      ? 'bg-[#FF7B22] text-white'
                      : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
                >
                  📱 Card
                </button>
              </div>

              {/* Emergency Route Link */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-sm text-gray-300 mb-2">Emergency Route Link:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://www.alertup.world/scan/route/qr_${node.buildingId}_${node.floorNumber}_${node._id}`}
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white text-xs font-mono"
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
                    className="px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 text-sm transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="text-center">
                <div className="inline-block p-4 bg-white rounded-lg border border-white/20">
                  {qrData.svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: qrData.svgContent }} />
                  ) : (
                    <img src={qrData.url} alt="QR Code" className="w-32 h-32" />
                  )}
                  <div className="mt-3">
                    <div className="font-bold text-sm text-[#FF7B22]">
                      {buildingName || 'Emergency Route'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {node.label || node.type} - Floor {floorName || '1'}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    www.alertup.world
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 font-medium transition-colors"
                >
                  📱 Download
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
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
