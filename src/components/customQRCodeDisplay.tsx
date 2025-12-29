import { useState } from 'react';
import { generateQRCode, downloadQRCodeAsFile, type QRCodeRequest } from '../apis/qrApi';
import { type Node } from '../apis/nodesApi';

interface CustomQRCodeDisplayProps {
  node?: Node;
  buildingName?: string;
  floorName?: string;
  onClose: () => void;
}

const CustomQRCodeDisplay = ({ node, buildingName, floorName, onClose }: CustomQRCodeDisplayProps) => {
  const [format, setFormat] = useState<'png' | 'svg'>('svg');
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Customization options
  const [customization, setCustomization] = useState({
    primaryColor: '#000000',
    backgroundColor: '#FFFFFF',
    title: buildingName || 'Emergency Route',
    titleColor: '#FF7B22',
    subtitle: node ? `${node.label || node.type} - Floor ${floorName || '1'}` : `Floor ${floorName || '1'}`,
    subtitleColor: '#353535',
    size: 'medium' as 'small' | 'medium' | 'large'
  });

  // Website colors matching the design
  const colorPresets = [
    { name: 'Default', primary: '#000000', background: '#FFFFFF', title: '#FF7B22', subtitle: '#353535', titleColor: '#FF7B22', subtitleColor: '#353535' },
    { name: 'Dark Mode', primary: '#FFFFFF', background: '#1a1a1a', title: '#FF7B22', subtitle: '#ffffff', titleColor: '#FF7B22', subtitleColor: '#ffffff' },
    { name: 'Orange Theme', primary: '#FF7B22', background: '#FFF5EB', title: '#000000', subtitle: '#353535', titleColor: '#000000', subtitleColor: '#353535' },
    { name: 'Blue Theme', primary: '#007BFF', background: '#E7F5FF', title: '#004085', subtitle: '#353535', titleColor: '#004085', subtitleColor: '#353535' },
    { name: 'Green Theme', primary: '#28A745', background: '#F0FFF4', title: '#155724', subtitle: '#353535', titleColor: '#155724', subtitleColor: '#353535' }
  ];

  const generateQR = async () => {
    try {
      setLoading(true);
      setError('');
      
      const request: QRCodeRequest = {
        nodeId: node?._id,
        buildingId: node?.buildingId,
        floorNumber: node?.floorNumber,
        format,
        customization
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

  const handleDownload = async (size: 'small' | 'large') => {
    if (!qrData?.filename) return;
    
    try {
      const nodeName = node?.label || `${node?.type}-node` || 'emergency-route';
      const sizeSuffix = size === 'large' ? '-large' : '-small';
      await downloadQRCodeAsFile(qrData.filename, `${nodeName}${sizeSuffix}`);
    } catch (err: any) {
      setError(err.message || 'Failed to download QR code');
    }
  };

  const handlePrint = () => {
    if (!qrData?.svgContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Failed to open print window');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${customization.title}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .qr-container { text-align: center; }
            .qr-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; color: ${customization.titleColor}; }
            .qr-subtitle { font-size: 16px; margin-bottom: 20px; color: ${customization.subtitleColor}; }
            .qr-image { max-width: 300px; margin: 0 auto; }
            .qr-footer { margin-top: 20px; font-size: 14px; color: #666; }
            @media print {
              body { padding: 0; }
              .qr-container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-title">${customization.title}</div>
            <div class="qr-subtitle">${customization.subtitle}</div>
            <div class="qr-image">${qrData.svgContent}</div>
            <div class="qr-footer">www.alertup.world</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Custom QR Code</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Customization Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Color Presets */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Color Themes</h3>
              <div className="grid grid-cols-2 gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setCustomization({
                      ...customization,
                      primaryColor: preset.primary,
                      backgroundColor: preset.background,
                      titleColor: preset.title,
                      subtitleColor: preset.subtitle
                    })}
                    className="p-3 border rounded-lg hover:border-blue-500 transition-colors"
                    style={{
                      backgroundColor: preset.background,
                      borderColor: '#e5e7eb'
                    }}
                  >
                    <div className="text-sm font-medium" style={{ color: preset.titleColor }}>
                      {preset.name}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }}></div>
                      <div className="w-4 h-4 rounded border" style={{ backgroundColor: preset.subtitleColor }}></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Custom Colors</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">QR Code Color</label>
                  <input
                    type="color"
                    value={customization.primaryColor}
                    onChange={(e) => setCustomization({...customization, primaryColor: e.target.value})}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Background Color</label>
                  <input
                    type="color"
                    value={customization.backgroundColor}
                    onChange={(e) => setCustomization({...customization, backgroundColor: e.target.value})}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Title Color</label>
                  <input
                    type="color"
                    value={customization.titleColor}
                    onChange={(e) => setCustomization({...customization, titleColor: e.target.value})}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Text Customization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Text Content</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                  <input
                    type="text"
                    value={customization.title}
                    onChange={(e) => setCustomization({...customization, title: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Building name or title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={customization.subtitle}
                    onChange={(e) => setCustomization({...customization, subtitle: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Floor info or node details"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Size</label>
                  <select
                    value={customization.size}
                    onChange={(e) => setCustomization({...customization, size: e.target.value as 'small' | 'medium' | 'large'})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="small">Small (200x200)</option>
                    <option value="medium">Medium (300x300)</option>
                    <option value="large">Large (400x400)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-700">Format</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setFormat('svg')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    format === 'svg' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  SVG
                </button>
                <button
                  onClick={() => setFormat('png')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    format === 'png' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  PNG
                </button>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="mb-6">
            <button
              onClick={generateQR}
              disabled={loading}
              className="w-full px-6 py-3 bg-[#FF7B22] text-white rounded-lg font-medium hover:bg-[#FF7B22]/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* QR Code Display */}
          {qrData && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="text-center">
                <div 
                  className="inline-block p-6 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: customization.backgroundColor }}
                >
                  {qrData.svgContent ? (
                    <div dangerouslySetInnerHTML={{ __html: qrData.svgContent }} />
                  ) : (
                    <img src={qrData.url} alt="QR Code" className="max-w-full" />
                  )}
                  <div className="mt-4">
                    <div className="font-bold text-lg" style={{ color: customization.titleColor }}>
                      {customization.title}
                    </div>
                    <div className="text-sm" style={{ color: customization.subtitleColor }}>
                      {customization.subtitle}
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    www.alertup.world
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleDownload('small')}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  📱 Small Card
                </button>
                <button
                  onClick={() => handleDownload('large')}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  🖨️ Large Paper
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomQRCodeDisplay;
