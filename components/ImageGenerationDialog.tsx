'use client';

import { useState, useRef } from 'react';

interface ImageGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (referenceImages: File[], model: string, numImages: number, aspectRatio: string, size: string) => void;
  generating: boolean;
}

export default function ImageGenerationDialog({
  isOpen,
  onClose,
  onGenerate,
  generating,
}: ImageGenerationDialogProps) {
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('seedream-4.5');
  const [numImages, setNumImages] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [size, setSize] = useState<string>('4K');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setReferenceImages(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (referenceImages.length > 0) {
      onGenerate(referenceImages, selectedModel, numImages, aspectRatio, size);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Generate Images</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Reference Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Images *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-500 transition-colors duration-200 text-gray-600"
            >
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Click to upload reference images</span>
              </div>
            </button>
            {referenceImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {referenceImages.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Reference ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Model *
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input-field"
            >
              <option value="seedream-4.5">Seedream 4.5</option>
              <option value="nano-banana-pro">Nano Banana Pro</option>
              <option value="nano-banana">Nano Banana</option>
            </select>
          </div>

          {/* Number of Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Images per Scene
            </label>
            <select
              value={numImages}
              onChange={(e) => setNumImages(Number(e.target.value))}
              className="input-field"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aspect Ratio
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="input-field"
            >
              <option value="16:9">16:9</option>
              <option value="1:1">1:1</option>
              <option value="9:16">9:16</option>
            </select>
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Size
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSize('2K')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  size === '2K'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                2K
              </button>
              <button
                type="button"
                onClick={() => setSize('4K')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                  size === '4K'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                4K
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={referenceImages.length === 0 || generating}
              className="flex-1 btn-primary text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

