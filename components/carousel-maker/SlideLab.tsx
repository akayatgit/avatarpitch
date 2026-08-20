'use client';

import { Download, Sparkles, Trash2 } from 'lucide-react';
import {
  MAX_REFERENCE_IMAGES,
  selectedGeneration,
  type CarouselSlide,
} from '@/lib/carouselMaker';
import { downloadImage } from '@/lib/carouselMakerClient';
import ReferenceImagePicker from './ReferenceImagePicker';

const ROLE_COPY: Record<
  CarouselSlide['role'],
  { title: string; textLabel: string; textPlaceholder: string; empty: string }
> = {
  hook: {
    title: 'Hook — slide 1',
    textLabel: 'Hook text (rendered on the poster)',
    textPlaceholder: "e.g. TOP MNC'S ARE HIRING — Both for Freshers & Experienced",
    empty: 'The scroll-stopper. You as the movie hero with the hook as massive metallic text.',
  },
  content: {
    title: 'Content slide',
    textLabel: 'Slide content (one line per row)',
    textPlaceholder: 'e.g.\n1. Infosys — Data Analyst\n2. TCS — QA Engineer\n3. Zoho — Backend Dev',
    empty: 'Same grandeur style, but the information owns the frame.',
  },
  cta: {
    title: 'CTA — final slide',
    textLabel: 'CTA text',
    textPlaceholder: 'e.g. Follow for daily job updates\nComment "JOBS" for the link',
    empty: 'You facing the camera, inviting the follow/comment/save.',
  },
};

interface SlideLabProps {
  slide: CarouselSlide;
  label: string;
  generating: boolean;
  canDelete: boolean;
  updateSlide: (patch: Partial<CarouselSlide>) => void;
  onDeleteSlide: () => void;
  onSelectGeneration: (generationId: string) => void;
  onDeleteGeneration: (generationId: string) => void;
}

/**
 * The per-slide workspace: preview + version history on top (thumb reads),
 * inputs below, primary action lives in the wizard's sticky bottom bar.
 */
export default function SlideLab({
  slide,
  label,
  generating,
  canDelete,
  updateSlide,
  onDeleteSlide,
  onSelectGeneration,
  onDeleteGeneration,
}: SlideLabProps) {
  const copy = ROLE_COPY[slide.role];
  const current = selectedGeneration(slide);
  const downloadName = `${label.toLowerCase().replace(/\s+/g, '-')}.png`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white">{copy.title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{copy.empty}</p>
      </div>

      {/* Preview */}
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-gray-800 bg-gray-950">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.imageUrl}
            alt={`${label} preview`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600 px-8 text-center">
            <Sparkles className="w-8 h-8" />
            <p className="text-sm">Nothing generated yet</p>
            <p className="text-xs text-gray-700">
              Fill the inputs below, then hit Generate
            </p>
          </div>
        )}

        {generating && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#D1FE17] border-t-transparent animate-spin" />
            <p className="text-xs text-gray-300">Composing + blending face… ~60–90s</p>
          </div>
        )}

        {current && !generating && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={() => downloadImage(current.imageUrl, downloadName)}
              className="w-11 h-11 rounded-full bg-black/70 border border-gray-700 text-white flex items-center justify-center touch-manipulation active:bg-[#D1FE17] active:text-black"
              aria-label="Download this slide"
            >
              <Download className="w-[18px] h-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteGeneration(current.id)}
              className="w-11 h-11 rounded-full bg-black/70 border border-gray-700 text-white flex items-center justify-center touch-manipulation active:bg-red-950 active:text-red-300"
              aria-label="Delete this version"
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
      </div>

      {/* Version history */}
      {slide.generations.length > 1 && (
        <div>
          <span className="text-sm font-medium text-gray-200">
            Versions ({slide.generations.length})
          </span>
          <div className="flex gap-3 overflow-x-auto mt-2 pb-1 -mx-4 px-4">
            {[...slide.generations].reverse().map((generation) => {
              const isSelected = current?.id === generation.id;
              return (
                <button
                  key={generation.id}
                  type="button"
                  onClick={() => onSelectGeneration(generation.id)}
                  className={`relative flex-shrink-0 w-16 aspect-[4/5] rounded-lg overflow-hidden border-2 touch-manipulation ${
                    isSelected ? 'border-[#D1FE17]' : 'border-gray-800'
                  }`}
                  aria-label="Select this version"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generation.imageUrl}
                    alt="Version"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Text */}
      <div>
        <label className="text-sm font-medium text-gray-200" htmlFor={`text-${slide.id}`}>
          {copy.textLabel}
        </label>
        <textarea
          id={`text-${slide.id}`}
          value={slide.text}
          onChange={(event) => updateSlide({ text: event.target.value })}
          placeholder={copy.textPlaceholder}
          rows={slide.role === 'content' ? 5 : 3}
          className="mt-2 w-full rounded-xl bg-gray-950 border border-gray-800 text-white text-base px-4 py-3 placeholder:text-gray-600 focus:border-[#D1FE17] focus:outline-none resize-y"
        />
        <p className="text-[11px] text-gray-600 mt-1">
          Rendered letter-for-letter as the poster typography.
        </p>
      </div>

      {/* Theme */}
      <div>
        <label className="text-sm font-medium text-gray-200" htmlFor={`theme-${slide.id}`}>
          Theme note (optional)
        </label>
        <input
          id={`theme-${slide.id}`}
          type="text"
          value={slide.themeNote}
          onChange={(event) => updateSlide({ themeNote: event.target.value })}
          placeholder="e.g. Jailer mass intro — red & gold, stormy sky"
          className="mt-2 w-full rounded-xl bg-gray-950 border border-gray-800 text-white text-base px-4 py-3 min-h-[48px] placeholder:text-gray-600 focus:border-[#D1FE17] focus:outline-none"
        />
      </div>

      {/* Movie poster theme key */}
      <ReferenceImagePicker
        label="Movie poster reference"
        hint="The theme key — a Kollywood poster whose wardrobe, palette and mood restyle this slide."
        urls={slide.movieRefImageUrls}
        onChange={(urls) => updateSlide({ movieRefImageUrls: urls })}
        max={2}
      />

      {/* Iteration refs */}
      <ReferenceImagePicker
        label="Extra references"
        hint="Add more references while iterating — framing, props, lighting, texture."
        urls={slide.extraRefImageUrls}
        onChange={(urls) => updateSlide({ extraRefImageUrls: urls })}
        max={MAX_REFERENCE_IMAGES}
      />

      {/* Danger zone */}
      {canDelete && (
        <button
          type="button"
          onClick={onDeleteSlide}
          className="w-full min-h-[48px] rounded-xl border border-red-900/60 text-red-400 text-sm font-medium flex items-center justify-center gap-2 touch-manipulation active:bg-red-950/40"
        >
          <Trash2 className="w-4 h-4" />
          Delete this slide
        </button>
      )}
    </div>
  );
}
