'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';

interface ReferenceImagePickerProps {
  label: string;
  hint?: string;
  urls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

/**
 * Mobile-first reference image grid: tap to add from gallery/camera,
 * tap the X to remove. Uploads go through /api/upload-image so every
 * reference has a stable public URL for Replicate.
 */
export default function ReferenceImagePicker({
  label,
  hint,
  urls,
  onChange,
  max = 6,
}: ReferenceImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const room = Math.max(0, max - urls.length);
      const selected = Array.from(files).slice(0, room);
      const uploaded: string[] = [];
      for (const file of selected) {
        const formData = new FormData();
        formData.append('images', file);
        const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.url) {
          throw new Error(data?.error || 'Upload failed');
        }
        uploaded.push(data.url);
      }
      if (uploaded.length > 0) {
        onChange([...urls, ...uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (index: number) => {
    onChange(urls.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <span className="text-[11px] text-gray-500">
          {urls.length}/{max}
        </span>
      </div>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}

      <div className="grid grid-cols-4 gap-3 mt-2">
        {urls.map((url, index) => (
          <div key={`${url}-${index}`} className="relative aspect-[4/5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${label} ${index + 1}`}
              className="w-full h-full object-cover rounded-lg border border-gray-800"
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={`Remove ${label} ${index + 1}`}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gray-950 border border-gray-700 text-gray-300 flex items-center justify-center touch-manipulation active:bg-red-950 active:text-red-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {urls.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-[4/5] rounded-lg border border-dashed border-gray-700 text-gray-500 flex flex-col items-center justify-center gap-1 touch-manipulation active:border-[#D1FE17] active:text-[#D1FE17] disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px] font-medium">Add</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
}
