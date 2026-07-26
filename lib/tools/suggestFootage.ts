import { type ScaleMode } from '@/lib/styles/surrealTech';
import { parseModelJson, runGeminiVision } from '@/lib/tools/geminiVision';
import { resolveInspirationImageUrl } from '@/lib/tools/resolveInspirationImage';

export interface FootageSuggestion {
  title: string;
  concept: string;
  scale: ScaleMode;
  /** Nano Banana still prompt — MUST be the isometric diorama template */
  imagePrompt: string;
  /** Short motion / beat hints for later video assemble */
  motionHint: string;
  /** What Gemini saw in the inspiration (for later prompt weight) */
  inspirationRead?: string;
}

export interface SuggestFootageResult {
  suggestions: FootageSuggestion[];
  inspirationImageUrl: string;
  inspirationRead: string | null;
}

/**
 * Canonical Nano Banana prompt shape — navigable miniature worlds for drone flythrough.
 * Fill slots only; do not invent a different structure.
 */
/** ~80% fidelity to the Pinterest/inspiration image is mandatory for suggestions. */
export const INSPIRATION_FIDELITY_80 =
  'Replicate the attached inspiration/Pinterest image at approximately 80% visual fidelity — keep the same main subjects, pose, composition, colors, lighting, materials language, and overall look. Only ~20% may adapt for tech/teaching metaphor and navigable diorama depth.';

export const NANO_BANANA_DIORAMA_TEMPLATE =
  'An isometric 3D miniature diorama of a [place] at [time of the day]. Warm light spills from the [source]. Tiny detailed figures sit at the [Place]. [moving environments in the setup like water/fire/wind/steam]. [focus Object text] reflect neon signs on the [place]. Tilt-shift photography effect.';

export function buildNanoBananaDioramaPrompt(parts: {
  place: string;
  timeOfDay: string;
  lightSource: string;
  gatheringPlace: string;
  movingEnvironment: string;
  focusObject: string;
}): string {
  const place = parts.place.trim();
  return [
    INSPIRATION_FIDELITY_80,
    `An isometric 3D miniature diorama of a ${place} at ${parts.timeOfDay.trim()}.`,
    `Warm light spills from the ${parts.lightSource.trim()}.`,
    `Tiny detailed figures sit at the ${parts.gatheringPlace.trim()}.`,
    `${parts.movingEnvironment.trim().replace(/\.?\s*$/, '.')}`,
    `${parts.focusObject.trim()} reflect neon signs on the ${place}.`,
    'Tilt-shift photography effect.',
  ].join(' ');
}

function looksLikeDioramaPrompt(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    p.includes('isometric') &&
    p.includes('diorama') &&
    p.includes('tilt-shift')
  );
}

function fallbackSuggestions(topic: string, inspirationRead: string | null): FootageSuggestion[] {
  const t = topic.trim() || 'software engineering salaries';
  const heroCue = inspirationRead
    ? `inspired by ${inspirationRead.slice(0, 120)}`
    : 'inspired by the attached reference image hero subjects';

  const slots: Array<{
    title: string;
    scale: ScaleMode;
    place: string;
    time: string;
    source: string;
    sitAt: string;
    moving: string;
    focus: string;
  }> = [
    {
      title: 'Night Tech Bazaar Diorama',
      scale: 'gigantic',
      place: `silicon salary bazaar (${heroCue}) teaching ${t}`,
      time: 'night',
      source: 'neon shop awnings and warm paper lanterns',
      sitAt: 'counter of a glowing chip-tea stall',
      moving: 'Steam rises from bowls; light rain puddles shimmer on the street',
      focus: 'Stacks of pay-stub chips and a marble statue holding cash',
    },
    {
      title: 'Dawn Chip Canyon Diorama',
      scale: 'microscopic',
      place: `microscopic chip canyon village about ${t}`,
      time: 'dawn',
      source: 'the rising sun over gold circuit ridges',
      sitAt: 'transistor terraces along the data river',
      moving: 'Mist and soft wind move through cable bridges',
      focus: 'A tiny statue-hero with money reimagined as wafer stacks',
    },
    {
      title: 'Sunset Motherboard Plaza',
      scale: 'gigantic',
      place: `motherboard plaza city block explaining ${t}`,
      time: 'sunset',
      source: 'warm sunset light and LED billboards',
      sitAt: 'cafe tables on a PCB plaza',
      moving: 'Gentle wind flutters banners; fountain spray catches light',
      focus: 'Focus object: a statue with sunglasses and cash',
    },
    {
      title: 'Rainy Server Alley',
      scale: 'gigantic',
      place: `rainy server-alley diorama for ${t}`,
      time: 'night',
      source: 'warm light spilling from server-rack doorways',
      sitAt: 'stools outside a ramen-like cable shop',
      moving: 'Rain puddles and steam from street vents',
      focus: 'Focus object: glowing salary cards and the inspiration statue',
    },
    {
      title: 'Golden Hour Code Market',
      scale: 'microscopic',
      place: `golden-hour code market inside a GPU die about ${t}`,
      time: 'golden hour',
      source: 'low sun through translucent silicon canopies',
      sitAt: 'tiny stalls along a copper trace boulevard',
      moving: 'Floating dust motes and soft steam from food stalls',
      focus: 'Focus object: the inspiration figure holding chip-cash',
    },
    {
      title: 'Midnight Neon Campus',
      scale: 'gigantic',
      place: `midnight neon coding campus about ${t}`,
      time: 'midnight',
      source: 'neon campus gates and warm dorm windows',
      sitAt: 'benches around a central chip fountain',
      moving: 'Light fog and drifting leaves in a soft breeze',
      focus: 'Focus object: marble tech statue with money and sunglasses',
    },
  ];

  return slots.map((s) => ({
    title: s.title,
    concept: `Isometric tilt-shift diorama — navigable for a drone flythrough — teaching ${t}.`,
    scale: s.scale,
    imagePrompt: buildNanoBananaDioramaPrompt({
      place: s.place,
      timeOfDay: s.time,
      lightSource: s.source,
      gatheringPlace: s.sitAt,
      movingEnvironment: s.moving,
      focusObject: s.focus,
    }),
    motionHint:
      'FPV drone slowly flies through the entire miniature diorama — streets, counters, open paths — tilt-shift depth, no teleport jumps.',
  }));
}

/**
 * Suggest Nano Banana diorama concepts from inspiration image + teaching topic.
 * imagePrompt is ALWAYS the isometric miniature diorama template (drone-navigable).
 */
export async function suggestFootage(
  topic: string,
  inspirationImageUrl: string,
  count = 6
): Promise<SuggestFootageResult> {
  const n = Math.min(Math.max(count, 3), 6);
  const resolved = await resolveInspirationImageUrl(inspirationImageUrl);

  const system = `You invent SURREAL TECH miniature worlds for Instagram Reels educators.
These stills are for Nano Banana 2, then a DRONE / FPV flythrough — navigable 3D space.

HIGHEST PRIORITY: ${INSPIRATION_FIDELITY_80}

CRITICAL — imagePrompt MUST start with the 80% fidelity sentence, then use EXACTLY this diorama format (fill brackets; keep skeleton):
"${NANO_BANANA_DIORAMA_TEMPLATE}"

Rules for filling slots:
- [place] / [focus Object]: MUST visibly preserve the inspiration's main subjects (statue, person, props, etc.) at ~80% likeness — place them as the hero landmark inside the diorama.
- Teaching topic may only tweak the remaining ~20% (materials, neon, tiny tech props).
- [time of the day], [source], gathering [Place], moving environments: fill concretely.
- Prefer open paths around the hero so a drone can fly through.

Also:
- inspirationRead: 2–3 sentences naming inspiration subjects + palette (be specific).
- title + concept: short labels.
- scale: "microscopic" or "gigantic".
- motionHint: drone flythrough through the WHOLE space.
- Return exactly ${n} suggestions.
- Do NOT invent a totally different scene that abandons the inspiration subjects.

Respond with ONLY JSON:
{"inspirationRead":"...","suggestions":[{"title":"...","concept":"...","scale":"microscopic"|"gigantic","imagePrompt":"${INSPIRATION_FIDELITY_80} An isometric 3D miniature diorama of a ... Tilt-shift photography effect.","motionHint":"..."}]}`;

  try {
    const content = await runGeminiVision({
      prompt: [
        `Avatar will explain:\n${topic.trim()}`,
        `Number of suggestions: ${n}`,
        'Read the attached inspiration image. Suggestions must look ~80% like THAT image (same subjects/composition/look). Only ~20% diorama/tech adaptation. Use the required Nano Banana template. Navigable for a drone.',
      ].join('\n\n'),
      images: [resolved],
      systemInstruction: system,
      temperature: 0.55,
      maxOutputTokens: 6144,
    });

    const parsed = parseModelJson<{
      inspirationRead?: string;
      suggestions?: unknown[];
    }>(content);

    const inspirationRead =
      typeof parsed?.inspirationRead === 'string' ? parsed.inspirationRead.trim() : null;

    const suggestions: FootageSuggestion[] = [];
    for (const raw of parsed?.suggestions ?? []) {
      if (!raw || typeof raw !== 'object') continue;
      const s = raw as Record<string, unknown>;
      if (typeof s.title !== 'string' || typeof s.imagePrompt !== 'string') continue;
      let imagePrompt = s.imagePrompt.trim();
      if (!looksLikeDioramaPrompt(imagePrompt)) {
        // Force template if the model drifted
        imagePrompt = buildNanoBananaDioramaPrompt({
          place: `${s.title} world about ${topic.trim()}`,
          timeOfDay: 'night',
          lightSource: 'warm neon shop entrances',
          gatheringPlace: 'central counter',
          movingEnvironment: 'Steam and light rain puddles animate the street',
          focusObject:
            typeof s.concept === 'string'
              ? `Focus object from concept: ${s.concept.slice(0, 100)}`
              : 'Focus object from the inspiration image',
        });
      }
      const scale: ScaleMode = s.scale === 'microscopic' ? 'microscopic' : 'gigantic';
      suggestions.push({
        title: s.title.trim(),
        concept: typeof s.concept === 'string' ? s.concept.trim() : s.title.trim(),
        scale,
        imagePrompt,
        motionHint:
          typeof s.motionHint === 'string'
            ? s.motionHint.trim()
            : 'FPV drone flies through the entire miniature diorama along open paths; tilt-shift depth.',
        inspirationRead: inspirationRead ?? undefined,
      });
    }

    if (suggestions.length === 0) {
      return {
        suggestions: fallbackSuggestions(topic, inspirationRead).slice(0, n),
        inspirationImageUrl: resolved,
        inspirationRead,
      };
    }

    return {
      suggestions: suggestions.slice(0, n),
      inspirationImageUrl: resolved,
      inspirationRead,
    };
  } catch (error) {
    console.error('suggestFootage vision error:', error);
    return {
      suggestions: fallbackSuggestions(topic, null).slice(0, n),
      inspirationImageUrl: resolved,
      inspirationRead: null,
    };
  }
}
