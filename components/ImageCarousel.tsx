'use client';

interface GeneratedImage {
  sceneIndex: number;
  url: string;
  generating?: boolean;
  imageIndex?: number;
}

interface ImageCarouselProps {
  images: GeneratedImage[];
  onImageClick: (image: GeneratedImage) => void;
}

export default function ImageCarousel({ images, onImageClick }: ImageCarouselProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Generated Images</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {images.map((image, index) => (
          <div
            key={`${image.sceneIndex}-${index}`}
            className="flex-shrink-0 cursor-pointer group"
            onClick={() => !image.generating && onImageClick(image)}
          >
            <div className="relative w-32 h-48 rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-purple-500 transition-colors">
              {image.generating ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-gray-600">Generating...</p>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={image.url}
                    alt={`Scene ${image.sceneIndex}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-2 py-1">
                    Scene {image.sceneIndex}{image.imageIndex !== undefined && image.imageIndex > 0 ? ` #${image.imageIndex + 1}` : ''}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

