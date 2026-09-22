import { useState } from "react";
import { uploadSVG, convertToSVG, updateFloorMap, type UploadResponse } from "../../apis/uploadApi";
import { cn } from "../../lib/cn";
import { Alert } from "../ui/feedback";
import { buttonStyles } from "../ui/styles";
import {
  CheckCircleIcon,
  FileTextIcon,
  ShieldCheckIcon,
  SpinnerIcon,
} from "../ui/icons";

const SECURITY_FEATURES = [
  "SVG file validation",
  "File size limits (5MB max)",
  "Content sanitization",
  "Automatic conversion for other formats",
  "Secure file storage",
] as const;

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
    // Cleared so re-picking the same file fires onChange again. Otherwise a
    // user whose upload failed could select the identical file and see nothing
    // happen, because the input's value had not changed.
    e.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-ink">Upload Floor Map</h3>

      <div
        className={cn(
          "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
          dragActive
            ? "border-brand bg-brand-subtle"
            : "border-line bg-surface-2 hover:border-brand-border",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-brand-text">
          <FileTextIcon size={24} />
        </span>

        {uploading ? (
          <div role="status" className="flex flex-col items-center gap-2 text-brand-text">
            <SpinnerIcon size={28} />
            <p className="text-sm font-medium">Uploading and processing...</p>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-ink-muted">
              Drag and drop your SVG file here, or click to select
            </p>
            <p className="mb-4 text-sm text-ink-subtle">
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
              className={cn(buttonStyles({ variant: "primary", size: "md" }), "cursor-pointer")}
            >
              Choose File
            </label>
          </div>
        )}

        {error && (
          <Alert tone="danger" className="mt-4 text-left">
            {error}
          </Alert>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
        <h4 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <ShieldCheckIcon size={16} className="shrink-0 text-brand-text" />
          Security Features
        </h4>
        <ul className="space-y-1.5 text-sm text-ink-muted">
          {SECURITY_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <CheckCircleIcon size={15} className="shrink-0 text-success-text" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SvgUploader;
