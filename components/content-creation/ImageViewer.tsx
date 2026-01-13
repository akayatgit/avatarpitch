'use client';

import { useEffect } from 'react';

interface GeneratedImage {
  sceneIndex: number;
  url: string;
  generating?: boolean;
  imageIndex?: number;
}

interface ImageViewerProps {
  image: GeneratedImage | null;
  images?: GeneratedImage[];
  onClose: () => void;
  onNavigate?: (image: GeneratedImage) => void;
}

export default function ImageViewer({ image, images = [], onClose, onNavigate }: ImageViewerProps) {
  if (!image) return null;

  // Find current image index in the images array
  const currentIndex = images.findIndex(
    (img) => img.sceneIndex === image.sceneIndex && 
             img.url === image.url &&
             (img.imageIndex ?? 0) === (image.imageIndex ?? 0)
  );

  const hasNext = currentIndex >= 0 && currentIndex < images.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext && onNavigate) {
      onNavigate(images[currentIndex + 1]);
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrevious && onNavigate) {
      onNavigate(images[currentIndex - 1]);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        e.preventDefault();
        onNavigate(images[currentIndex + 1]);
      } else if (e.key === 'ArrowLeft' && hasPrevious && onNavigate) {
        e.preventDefault();
        onNavigate(images[currentIndex - 1]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, hasNext, hasPrevious, images, onNavigate, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <img
          src={image.url}
          alt={`Scene ${image.sceneIndex}`}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Left arrow - Previous image */}
        {hasPrevious && (
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors z-10"
            aria-label="Previous image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right arrow - Next image */}
        {hasNext && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full w-12 h-12 flex items-center justify-center transition-colors z-10"
            aria-label="Next image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Image info */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-lg">
          {images.length > 1 ? (
            <span>
              Scene {image.sceneIndex} ({currentIndex + 1} / {images.length})
            </span>
          ) : (
            <span>Scene {image.sceneIndex}</span>
          )}
        </div>
      </div>
    </div>
  );
}

