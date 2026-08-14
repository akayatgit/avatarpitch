'use client';

/**
 * Live 9:16 preview of one section: the background video (or image) with the
 * canvas-rendered overlay PNG on top — the exact composite ffmpeg produces.
 */
interface SectionPreviewProps {
  backgroundUrl: string | null;
  backgroundType: 'video' | 'image' | null;
  overlayDataUrl: string | null;
  className?: string;
}

export default function SectionPreview({
  backgroundUrl,
  backgroundType,
  overlayDataUrl,
  className = '',
}: SectionPreviewProps) {
  return (
    <div
      className={`relative aspect-[9/16] w-full max-w-[260px] mx-auto rounded-xl overflow-hidden bg-black border border-gray-800 ${className}`}
    >
      {backgroundUrl &&
        (backgroundType === 'video' ? (
          <video
            src={backgroundUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundUrl}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ))}
      {overlayDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={overlayDataUrl}
          alt="Overlay preview"
          className="absolute inset-0 w-full h-full"
        />
      )}
    </div>
  );
}
