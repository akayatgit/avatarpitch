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
  onSkip?: (image: GeneratedImage) => void;
  selectedImages?: Set<string>;
  onImageSelect?: (imageId: string, selected: boolean) => void;
  selectedImagePairs?: Set<string>;
  onImagePairSelect?: (pairId: string, selected: boolean) => void;
}

export default function ImageCarousel({
  images,
  onImageClick,
  onSkip,
  selectedImages,
  onImageSelect,
  selectedImagePairs,
  onImagePairSelect,
}: ImageCarouselProps) {
  if (images.length === 0) {
    return null;
  }

  // Helper function to create consistent image IDs (matching ProjectResults)
  const getImageId = (image: GeneratedImage, index: number): string => {
    return `${image.sceneIndex}-${image.imageIndex ?? index}`;
  };

  const handleCheckboxClick = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    if (onImageSelect) {
      const isSelected = selectedImages?.has(imageId) || false;
      onImageSelect(imageId, !isSelected);
    }
  };

  const getPairId = (firstId: string, secondId: string): string => {
    return `${firstId}::${secondId}`;
  };

  const handlePairCheckboxClick = (e: React.MouseEvent, pairId: string) => {
    e.stopPropagation();
    if (onImagePairSelect) {
      const isSelected = selectedImagePairs?.has(pairId) || false;
      onImagePairSelect(pairId, !isSelected);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-6 shadow-sm border border-gray-800">
      <h2 className="text-base sm:text-lg font-semibold text-white mb-4">Generated Images</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {images.map((image, index) => {
          const imageId = getImageId(image, index);
          const isSelected = selectedImages?.has(imageId) || false;
          const nextImage = images[index + 1];
          const nextImageId = nextImage ? getImageId(nextImage, index + 1) : null;
          const pairId = nextImageId ? getPairId(imageId, nextImageId) : null;
          const isPairSelected = pairId ? selectedImagePairs?.has(pairId) || false : false;
          const canSelectPair = !!pairId && isSelected && (selectedImages?.has(nextImageId!) || false);
          
          return (
            <div key={imageId} className="flex items-center gap-3 flex-shrink-0">
              <div
                className="cursor-pointer group relative"
                onClick={() => !image.generating && onImageClick(image)}
              >
                <div className={`relative w-32 h-48 rounded-lg overflow-hidden border-2 transition-colors ${
                  isSelected ? 'border-[#D1FE17]' : 'border-gray-800 group-hover:border-[#D1FE17]'
                }`}>
                  {image.generating ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center relative">
                      <div className="text-center">
                        <div className="w-8 h-8 border-4 border-[#D1FE17] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-xs text-gray-400">Generating...</p>
                      </div>
                      {onSkip && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSkip(image);
                          }}
                          className="absolute bottom-2 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Skip
                        </button>
                      )}
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
                      {onImageSelect && (
                        <div 
                          className="absolute top-2 left-2 cursor-pointer"
                          onClick={(e) => handleCheckboxClick(e, imageId)}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-[#D1FE17] border-[#D1FE17]' 
                              : 'bg-black bg-opacity-60 border-white'
                          }`}>
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-black"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {onImagePairSelect && pairId && (
                <button
                  type="button"
                  onClick={(e) => canSelectPair && handlePairCheckboxClick(e, pairId)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                    canSelectPair
                      ? isPairSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-black bg-opacity-60 border-blue-400 hover:border-blue-300'
                      : 'bg-gray-800 border-gray-700 cursor-not-allowed opacity-50'
                  }`}
                  title="Use next image as last frame"
                  aria-disabled={!canSelectPair}
                >
                  {isPairSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

