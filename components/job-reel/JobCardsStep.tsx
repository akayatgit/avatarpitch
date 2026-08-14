'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  MAX_JOB_CARDS,
  createJobReelCard,
  duplicateJobReelCard,
  usableCards,
  type JobReelCard,
  type JobReelCta,
  type JobReelState,
} from '@/lib/jobReel';
import { renderCtaOverlayDataUrl, renderJobCardOverlayDataUrl } from '@/lib/jobReelCards';
import SectionPreview from './SectionPreview';
import SectionBackgroundPicker from './SectionBackgroundPicker';
import TowerFillPanel, { type TowerCardData } from './TowerFillPanel';

interface JobCardsStepProps {
  state: JobReelState;
  updateState: (patch: Partial<JobReelState>) => void;
  updateCard: (cardId: string, patch: Partial<JobReelCard>) => void;
  goToStep: (step: number) => void;
}

const TEXT_FIELDS: Array<{
  key: 'company' | 'role' | 'experience' | 'education';
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: 'company', label: 'Company', placeholder: 'Citi' },
  { key: 'role', label: 'Role', placeholder: 'Information Analyst' },
  { key: 'experience', label: 'Experience required', placeholder: '6 months - 2 years' },
  {
    key: 'education',
    label: 'Education / skills',
    placeholder: "Bachelor's degree (B.E, B.Tech, BCA…) with MIS/Data Analytics skills",
    multiline: true,
  },
];

function CardPreview({
  card,
  state,
}: {
  card: JobReelCard;
  state: JobReelState;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await (document as any).fonts?.ready;
        const dataUrl = await renderJobCardOverlayDataUrl(card);
        if (!cancelled) setPreviewUrl(dataUrl);
      } catch (error) {
        console.error('Card preview failed:', error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [card]);

  return (
    <SectionPreview
      backgroundUrl={card.backgroundUrl ?? state.backgroundUrl}
      backgroundType={card.backgroundUrl ? card.backgroundType : state.backgroundType}
      overlayDataUrl={previewUrl}
      className="mt-3"
    />
  );
}

/** Final CTA section editor — like/follow/comment, all lines editable. */
function CtaPanel({
  state,
  updateState,
}: {
  state: JobReelState;
  updateState: (patch: Partial<JobReelState>) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cta = state.cta;

  const updateCta = (patch: Partial<JobReelCta>) => {
    updateState({ cta: { ...cta, ...patch } });
  };

  useEffect(() => {
    if (!previewOpen) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await (document as any).fonts?.ready;
        const dataUrl = renderCtaOverlayDataUrl(cta);
        if (!cancelled) setPreviewUrl(dataUrl);
      } catch (error) {
        console.error('CTA preview failed:', error);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cta, previewOpen]);

  const FIELDS: Array<{ key: 'line1' | 'line2' | 'line3'; label: string }> = [
    { key: 'line1', label: 'Line 1 (white box)' },
    { key: 'line2', label: 'Line 2 (yellow box)' },
    { key: 'line3', label: 'Line 3 (red text)' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white font-medium">Final CTA card</p>
        <button
          type="button"
          onClick={() => updateCta({ enabled: !cta.enabled })}
          className={`text-[11px] px-3 py-1.5 rounded-full border touch-manipulation ${
            cta.enabled
              ? 'border-[#D1FE17] text-[#D1FE17] bg-[#D1FE17]/10'
              : 'border-gray-700 text-gray-400'
          }`}
        >
          {cta.enabled ? 'On' : 'Off'}
        </button>
      </div>

      {cta.enabled && (
        <>
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">
                {field.label}
              </label>
              <input
                type="text"
                value={cta[field.key]}
                onChange={(e) => updateCta({ [field.key]: e.target.value })}
                className="input-field text-sm min-h-[44px]"
              />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-300">CTA duration</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCta({ durationSec: Math.max(2, cta.durationSec - 1) })}
                disabled={cta.durationSec <= 2}
                className="w-9 h-9 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center disabled:opacity-30 touch-manipulation"
              >
                −
              </button>
              <span className="text-sm text-white font-semibold w-8 text-center">
                {cta.durationSec}s
              </span>
              <button
                type="button"
                onClick={() => updateCta({ durationSec: Math.min(10, cta.durationSec + 1) })}
                disabled={cta.durationSec >= 10}
                className="w-9 h-9 rounded-lg border border-gray-700 text-gray-300 flex items-center justify-center disabled:opacity-30 touch-manipulation"
              >
                +
              </button>
            </div>
          </div>

          <SectionBackgroundPicker
            currentUrl={cta.backgroundUrl}
            currentType={cta.backgroundType}
            onChange={(background) =>
              updateCta({
                backgroundUrl: background?.url ?? null,
                backgroundType: background?.type ?? null,
              })
            }
          />

          <button
            type="button"
            onClick={() => setPreviewOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200 touch-manipulation"
          >
            {previewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewOpen ? 'Hide preview' : 'Preview CTA card'}
          </button>
          {previewOpen && (
            <SectionPreview
              backgroundUrl={cta.backgroundUrl ?? state.backgroundUrl}
              backgroundType={cta.backgroundUrl ? cta.backgroundType : state.backgroundType}
              overlayDataUrl={previewUrl}
              className="mt-1"
            />
          )}
        </>
      )}
    </div>
  );
}

export default function JobCardsStep({
  state,
  updateState,
  updateCard,
  goToStep,
}: JobCardsStepProps) {
  const [previewOpenIds, setPreviewOpenIds] = useState<Record<string, boolean>>({});
  const [uploadingIds, setUploadingIds] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const addCard = () => {
    if (state.cards.length >= MAX_JOB_CARDS) return;
    updateState({ cards: [...state.cards, createJobReelCard()] });
  };

  const duplicateCard = (cardId: string) => {
    if (state.cards.length >= MAX_JOB_CARDS) return;
    const index = state.cards.findIndex((card) => card.id === cardId);
    if (index === -1) return;
    const copy = duplicateJobReelCard(state.cards[index]);
    const cards = [...state.cards];
    cards.splice(index + 1, 0, copy);
    updateState({ cards });
  };

  const removeCard = (cardId: string) => {
    if (state.cards.length <= 1) return;
    updateState({ cards: state.cards.filter((card) => card.id !== cardId) });
  };

  /** Logos stay in the browser as small data URLs — no server storage anywhere. */
  const uploadLogo = async (cardId: string, file: File) => {
    setUploadingIds((prev) => ({ ...prev, [cardId]: true }));
    setErrors((prev) => ({ ...prev, [cardId]: '' }));
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(objectUrl);
          // Downscale to 256px max — plenty for the card, tiny in localStorage
          const scale = Math.min(1, 256 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Could not read the image'));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('That file is not a readable image'));
        };
        image.src = objectUrl;
      });
      updateCard(cardId, { logoUrl: dataUrl });
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [cardId]: error instanceof Error ? error.message : 'Logo upload failed',
      }));
    } finally {
      setUploadingIds((prev) => ({ ...prev, [cardId]: false }));
    }
  };

  const readyCount = usableCards(state).length;

  /** Verbatim tower rows in; empty starter cards are replaced, filled ones are kept. */
  const fillFromTower = (towerCards: TowerCardData[]) => {
    const existingUsable = state.cards.filter(
      (card) =>
        card.company.trim() ||
        card.role.trim() ||
        card.experience.trim() ||
        card.education.trim() ||
        card.logoUrl
    );
    const mapped = towerCards.map((towerCard) => ({
      ...createJobReelCard(),
      company: towerCard.company ?? '',
      logoUrl: towerCard.logoUrl ?? null,
      role: towerCard.role ?? '',
      experience: towerCard.experience ?? '',
      education: towerCard.education ?? '',
      applyUrl: towerCard.applyUrl ?? '',
    }));
    updateState({ cards: [...existingUsable, ...mapped].slice(0, MAX_JOB_CARDS) });
  };

  return (
    <div className="space-y-4">
      <TowerFillPanel onFill={fillFromTower} maxCards={MAX_JOB_CARDS} />

      <p className="text-xs text-gray-500">
        One card per company — same colors, font and layout on every card. Fill only what you have;
        empty fields are simply left off the card.
      </p>

      {state.cards.map((card, index) => {
        const isUploading = Boolean(uploadingIds[card.id]);
        const isPreviewOpen = Boolean(previewOpenIds[card.id]);
        const error = errors[card.id];

        return (
          <div key={card.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#D1FE17]/15 text-[#D1FE17] text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <p className="text-sm text-white font-medium truncate flex-1">
                {card.company.trim() || `Job card ${index + 1}`}
              </p>
              <button
                type="button"
                onClick={() => duplicateCard(card.id)}
                disabled={state.cards.length >= MAX_JOB_CARDS}
                title="Duplicate card"
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 touch-manipulation"
              >
                <Copy className="w-4 h-4" />
              </button>
              {state.cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  title="Delete card"
                  className="p-2 text-gray-400 hover:text-red-400 touch-manipulation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Logo (optional) */}
            <div className="flex items-center gap-3">
              <input
                ref={(el) => {
                  fileInputsRef.current[card.id] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(card.id, file);
                  e.target.value = '';
                }}
              />
              {card.logoUrl ? (
                <div className="flex items-center gap-2">
                  <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCard(card.id, { logoUrl: null })}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 touch-manipulation"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove logo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputsRef.current[card.id]?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 text-xs text-gray-300 border border-gray-700 rounded-lg px-3 py-2.5 hover:border-gray-500 disabled:opacity-40 min-h-[44px] touch-manipulation"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4" />
                  )}
                  {isUploading ? 'Uploading…' : 'Company logo (optional)'}
                </button>
              )}
            </div>

            {TEXT_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    value={card[field.key]}
                    onChange={(e) => updateCard(card.id, { [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={2}
                    className="input-field text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={card[field.key]}
                    onChange={(e) => updateCard(card.id, { [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="input-field text-sm min-h-[44px]"
                  />
                )}
              </div>
            ))}

            {error && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Optional per-section background */}
            <SectionBackgroundPicker
              currentUrl={card.backgroundUrl}
              currentType={card.backgroundType}
              onChange={(background) =>
                updateCard(card.id, {
                  backgroundUrl: background?.url ?? null,
                  backgroundType: background?.type ?? null,
                })
              }
            />

            {/* Apply link — goes into the shareable PDF, never the video */}
            <div>
              <label className="text-[11px] text-gray-400 font-medium mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  Apply link
                </span>
                <span className="text-[10px] text-gray-500">for the PDF — not shown in video</span>
              </label>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                value={card.applyUrl}
                onChange={(e) => updateCard(card.id, { applyUrl: e.target.value })}
                placeholder="https://careers.company.com/job/…"
                className="input-field text-sm min-h-[44px]"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setPreviewOpenIds((prev) => ({ ...prev, [card.id]: !isPreviewOpen }))
              }
              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200 touch-manipulation"
            >
              {isPreviewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {isPreviewOpen ? 'Hide preview' : 'Preview this card'}
            </button>
            {isPreviewOpen && <CardPreview card={card} state={state} />}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addCard}
        disabled={state.cards.length >= MAX_JOB_CARDS}
        className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-3 min-h-[48px] disabled:opacity-40 touch-manipulation"
      >
        <Plus className="w-4 h-4" />
        Add job card
      </button>

      <CtaPanel state={state} updateState={updateState} />

      <button
        type="button"
        onClick={() => goToStep(4)}
        disabled={readyCount === 0}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3 min-h-[48px] disabled:opacity-40 touch-manipulation"
      >
        Next: Make the video ({readyCount} card{readyCount === 1 ? '' : 's'})
        <ArrowRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => goToStep(2)}
        className="btn-ghost w-full min-h-[44px] touch-manipulation"
      >
        ← Back to hook
      </button>
    </div>
  );
}
