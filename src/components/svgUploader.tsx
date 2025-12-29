import { useState } from "react";
import { uploadSVG, convertToSVG, updateFloorMap, type UploadResponse } from "../apis/uploadApi";

interface SvgUploaderProps {
  buildingId: string;
  floorNumber: number;
  onSvgUploaded: (svgData: { svgContent: string; width: number; height: number }) => void;
}

const SvgUploader = ({ buildingId, floorNumber, onSvgUploaded }: SvgUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    setError("");
    setUploading(true);

    try {
      let response: UploadResponse;

      // Check if it's an SVG file
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        response = await uploadSVG(file);
      } else {
        // Convert other image formats to SVG
        response = await convertToSVG(file);
      }

      if (response.success && response.data) {
        // Save the floor map data to the database
        try {
          await updateFloorMap(buildingId, floorNumber, {
            svgContent: response.data.svgContent,
            svgMapUrl: response.data.svgPath,
            width: response.data.width,
            height: response.data.height,
          });
        } catch (saveError: any) {
          console.error('Error saving floor map:', saveError);
          setError(`File uploaded but failed to save: ${saveError.message}`);
          return;
        }

        onSvgUploaded({
          svgContent: response.data.svgContent,
          width: response.data.width,
          height: response.data.height,
        });
      } else {
        setError(response.message || "Upload failed");
      }
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  return (
    <div className="p-6 bg-white/5 rounded-lg border border-white/10">
      <h3 className="text-xl font-bold mb-4">Upload Floor Map</h3>
      
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-[#FF7B22] bg-[#FF7B22]/10' 
            : 'border-white/30 hover:border-white/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-white/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        {uploading ? (
          <div className="text-[#FF7B22]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF7B22] mx-auto mb-2"></div>
            <p>Uploading and processing...</p>
          </div>
        ) : (
          <div>
            <p className="text-white/70 mb-2">
              Drag and drop your SVG file here, or click to select
            </p>
            <p className="text-white/50 text-sm mb-4">
              SVG files preferred. Other formats will be converted to SVG.
            </p>
            <input
              type="file"
              accept=".svg,image/svg+xml,image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="svg-upload"
            />
            <label
              htmlFor="svg-upload"
              className="inline-block px-4 py-2 bg-[#FF7B22] text-white rounded-lg hover:bg-[#FF7B22]/80 cursor-pointer transition-colors"
            >
              Choose File
            </label>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-black/30 rounded-lg">
        <h4 className="font-semibold mb-2 text-[#FF7B22]">Security Features:</h4>
        <ul className="text-sm text-white/70 space-y-1">
          <li>✅ SVG file validation</li>
          <li>✅ File size limits (5MB max)</li>
          <li>✅ Content sanitization</li>
          <li>✅ Automatic conversion for other formats</li>
          <li>✅ Secure file storage</li>
        </ul>
      </div>
    </div>
  );
};

export default SvgUploader;
