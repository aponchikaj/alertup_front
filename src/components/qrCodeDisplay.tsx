import { useState } from 'react';
import { generateQRCode, downloadQRCodeAsFile, type QRCodeRequest } from '../apis/qrApi';
import { type Node } from '../apis/nodesApi';

interface QRCodeDisplayProps {
  node: Node;
  onClose: () => void;
}

const QRCodeDisplay = ({ node, onClose }: QRCodeDisplayProps) => {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [error, setError] = useState('');

  const generateQR = async () => {
    try {
      setLoading(true);
      setError('');
      
      const request: QRCodeRequest = {
        nodeId: node._id,
        buildingId: node.buildingId,
        floorNumber: node.floorNumber,
        format
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

  const handleDownload = async () => {
    if (!qrData?.filename) return;
    
    try {
      await downloadQRCodeAsFile(qrData.filename, node.label || `${node.type}-node`);
    } catch (err: any) {
      setError(err.message || 'Failed to download QR code');
    }
  };

  const copyToClipboard = () => {
    if (qrData?.qrData) {
      navigator.clipboard.writeText(qrData.qrData);
      // You could add a toast notification here
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#353535] rounded-lg max-w-md w-full p-6 border border-white/20">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">QR Code for {node.label || node.type}</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Node Info */}
        <div className="mb-4 p-3 bg-black/30 rounded-lg">
          <div className="text-sm text-white/70">
            <p><span className="font-semibold">Type:</span> {node.type}</p>
            <p><span className="font-semibold">Location:</span> ({node.x}, {node.y})</p>
            <p><span className="font-semibold">Floor:</span> {node.floorNumber}</p>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-2">Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('png')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                format === 'png' 
                  ? 'bg-[#FF7B22] text-white' 
                  : 'bg-black/40 text-white/70 hover:bg-black/60'
              }`}
            >
              PNG
            </button>
            <button
              onClick={() => setFormat('svg')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                format === 'svg' 
                  ? 'bg-[#FF7B22] text-white' 
                  : 'bg-black/40 text-white/70 hover:bg-black/60'
              }`}
            >
              SVG
            </button>
          </div>
        </div>

        {/* Generate Button */}
        {!qrData && (
          <button
            onClick={generateQR}
            disabled={loading}
            className="w-full py-3 bg-[#FF7B22] text-white rounded-lg hover:bg-[#FF7B22]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generating...
              </div>
            ) : (
              'Generate QR Code'
            )}
          </button>
        )}

        {/* QR Code Display */}
        {qrData && (
          <div className="space-y-4">
            {/* QR Code Image */}
            <div className="flex justify-center p-4 bg-white rounded-lg">
              {format === 'png' && qrData.url ? (
                <img 
                  src={qrData.url} 
                  alt="QR Code" 
                  className="w-48 h-48"
                />
              ) : format === 'svg' && qrData.svgContent ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: qrData.svgContent }}
                  className="w-48 h-48"
                />
              ) : null}
            </div>

            {/* QR Code Info */}
            <div className="p-3 bg-black/30 rounded-lg">
              <p className="text-xs text-white/70 mb-1">QR Code Data:</p>
              <p className="text-xs text-white/50 break-all font-mono">{qrData.qrData}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-500/80 transition-colors"
              >
                Download
              </button>
              <button
                onClick={copyToClipboard}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-500/80 transition-colors"
              >
                Copy Link
              </button>
            </div>

            {/* Regenerate Button */}
            <button
              onClick={() => {
                setQrData(null);
                generateQR();
              }}
              className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-600/80 transition-colors"
            >
              Regenerate
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-[#FF7B22]/10 border border-[#FF7B22]/30 rounded-lg">
          <p className="text-xs text-[#FF7B22] font-semibold mb-1">How to use:</p>
          <ul className="text-xs text-white/70 space-y-1">
            <li>• Print this QR code and place it at the node location</li>
            <li>• Users can scan it to get emergency escape routes</li>
            <li>• The QR code will show the shortest path to the nearest exit</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default QRCodeDisplay;
