import { z } from 'zod';

export const ASSEMBLY_FORMAT = 'assembly_v1' as const;

export const ASSEMBLY_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;
export type AssemblyAspectRatio = (typeof ASSEMBLY_ASPECT_RATIOS)[number];

export const ASSEMBLY_VIDEO_MODELS = ['seedance-1-pro-fast', 'veo-3.1'] as const;
export type AssemblyVideoModel = (typeof ASSEMBLY_VIDEO_MODELS)[number];

export const MAX_BUILDINGS = 6;

/**
 * Prompt 1 template from the guide — "Object & Building Removal" (Nano Banana).
 * Turns the finished-property photo (Reference 2) into the empty plot (Reference 1)
 * while preserving framing, ground surfaces, and lighting (Golden Rules 1 & 3).
 */
export const DEFAULT_REMOVAL_PROMPT = `Remove the entire building structure, all architecture, outdoor furniture, seating, tables, planters, and fixtures from this image. Show a completely empty cleared plot of land with only the surrounding environmental ground surface intact.

Keep everything else exactly as it is: identical camera angle, identical field of view, identical crop, identical framing. Keep the road, curb lines, sidewalk pavement, surrounding background trees, and lighting completely unchanged. Fill the cleared area with clean matching ground pavement in the same materials already visible. Same lighting, same shadow direction, same time of day.`;

/**
 * Prompt 2 template from the guide — "Sequential Construction Animation".
 * Reference 1 (empty plot) is the video start frame, Reference 2 (original photo)
 * is the end frame; the building assembles itself in discrete grouped arrivals.
 */
export const DEFAULT_REVEAL_PROMPT = `Static real estate architectural construction reveal, 8 seconds. Locked-off camera. The only camera movement allowed is a subtle continuous drift of a few degrees that eases to a stop at 6s, small enough that the composition stays recognisably the same shot from start to finish. No dolly, no zoom, no whip pan.

CAMERA LOCK - ANGLE AND PERSPECTIVE NEVER CHANGE: The camera position, height, angle, focal length, field of view, and perspective are exactly those of the reference images and stay fixed for the entire 8 seconds. All vanishing points, floor grid lines, wall directions, and pavement edges remain in the same directions throughout. Do not reframe, re-angle, re-render, or re-photograph the lot from a different viewpoint. Do not change lens compression or widen the view. Do not reveal any part of the scene not visible in the reference images. The composition at every frame must overlay onto the reference images with the ground in the same place.

HOW TO USE THE TWO REFERENCE IMAGES - READ CAREFULLY: The first reference image is the state of the empty cleared lot at 0s. The second reference image is the state of the fully constructed building at 6s. These are two discrete states, NOT two ends of a blend. Do not interpolate between them. Do not cross-fade, morph, or gradually transform the first image into the second. Do not compute intermediate frames by mixing the two images together. Instead, the first image stays exactly as it is, unchanged, and the structural elements and furniture from the second image are placed onto it one group at a time until the building is complete. At every moment the frame shows the first image plus whichever construction elements have already arrived, never a partial blend of the two.

STRICT BUILDING INVENTORY - NOTHING NEW: The complete and final set of architectural elements, fixtures, and outdoor furniture is defined entirely by the second reference image. Every wall, window frame, door, sign, table, chair, and planter that appears must already be visible in the second reference image, in the same position, at the same scale, in the same orientation, in the same material, colour, and finish. Do not add, invent, substitute, duplicate, restyle, or embellish anything. No extra buildings, no extra seating, no extra plants, and no structural additions beyond exactly what the second reference image shows. If an element is absent from the second reference image, it must never appear at any point in the video. The final frame must contain exactly the same details as the second reference image, nothing more, nothing less.

ABSOLUTE LOCK: Ground flooring, surrounding environmental elements, horizon, and daylight direction are identical in both reference images and must stay identical for the entire 8 seconds, never redrawn, warped, shifted, or reinterpreted.

REVEAL METHOD - MIXED MOTION: Building components and furniture arrive in groups using different movements suited to their type, never all the same way. Every element is fully opaque, complete, and correctly proportioned from the first frame it is visible. An element either does not exist yet or exists fully, there is no in-between state.
POP-IN - core building walls, main door frame, and primary glass window grids: appears directly at its final ground position, slightly undersized for about two frames, overshoots very slightly, then settles to exact final size. Roughly 0.2 seconds. Silhouette and proportions never change, only overall scale.
DROP - awnings, roof features, secondary wall structures, and outdoor furniture: falls down from just above its final position and lands with a firm settle onto the ground.
DESCEND - wall signage, hanging lights, roof vines, and wall typography: lowers from above into final height on the building facade.
INSTANT - wall lamps, small signs, potted plants, and interior window accessories: appear in place in a single frame, no motion at all.

Each arrival takes about 0.2 to 0.3 seconds. Components travel only a short distance, no long flight paths, no crossing the frame. Shadows appear the moment a structural element or object lands or pops.

TIMELINE:
0-2s: The frame is exactly the first reference image (empty cleared lot), unchanged. Camera begins its slow drift.
2-3.5s: Core building walls, door openings, and primary window glass POP-IN onto the empty land. Everything else in the frame is unchanged.
3.5-5s: Roof structures, wall text, awnings, and outdoor seating DROP and DESCEND into position.
5-6s: Wall lamps, small decor, and potted plants appear INSTANT; all contact shadows land on the ground; camera drift eases to a stop. The frame now equals the second reference image exactly.
6-8s: The frame is exactly the second reference image, completely static, no new elements, no repositioning, no further changes. Faint leaf movement and stable daylight.

Photorealistic architectural exterior photography, natural daylight, modern building construction, no people.

Negative: changing camera angle, changing perspective, new viewpoint, reframing, re-angling, rotating camera, orbiting, arc shot, crane move, changing camera height, changing focal length, changing field of view, lens distortion, wide angle shift, perspective warp, shifting vanishing point, tilting horizon, revealing unseen areas of the lot, added structural elements, invented architecture, new props, restyled facade, changed building colour, changed materials, components not present in the reference, interpolation between reference images, blending two images, image morph, cross-fade between frames, gradual transformation, morphing, object morphing, shape shifting, transforming, geometry changing, slow growth, gradual scaling, growing from zero, unfolding, assembling from parts, dissolving in, fade in, fade out, cross dissolve, opacity transition, ghosting, double exposure, translucent objects, glowing particles, light shimmer, warping, melting, stretching, squashing, elastic wobble, flying across frame, floating elements, people, text, watermark, redrawn ground, changing ground layout, altered lighting direction, camera push in, dolly, zoom, whip pan.`;

/** One building slot in an assembly project. */
export const AssemblyBuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Reference 2 — the finished property photo (end state of the reveal). */
  originalImageUrl: z.string().nullable(),
  originalImageSource: z.enum(['upload', 'generated']).nullable(),
  /** Prompt used when AI-generating the finished building image (no photo available). */
  buildingPrompt: z.string(),
  /** Prompt 1 — building removal prompt (nano-banana image edit). */
  removalPrompt: z.string(),
  /** Reference 1 — the AI-generated empty plot (start state of the reveal). */
  emptyPlotUrl: z.string().nullable(),
  /** Prompt 2 — sequential construction reveal animation prompt. */
  videoPrompt: z.string(),
  videoModel: z.enum(ASSEMBLY_VIDEO_MODELS),
  videoUrl: z.string().nullable(),
});

export type AssemblyBuilding = z.infer<typeof AssemblyBuildingSchema>;

/** Full persisted state of an assembly project (stored in content_creation_requests.generated_output). */
export const AssemblyStateSchema = z.object({
  format: z.literal(ASSEMBLY_FORMAT),
  title: z.string(),
  aspectRatio: z.enum(ASSEMBLY_ASPECT_RATIOS),
  buildings: z.array(AssemblyBuildingSchema).min(1).max(MAX_BUILDINGS),
  step: z.number().int().min(1).max(3),
});

export type AssemblyState = z.infer<typeof AssemblyStateSchema>;

export function createAssemblyBuilding(index: number): AssemblyBuilding {
  return {
    id: `building-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Building ${index + 1}`,
    originalImageUrl: null,
    originalImageSource: null,
    buildingPrompt: '',
    removalPrompt: DEFAULT_REMOVAL_PROMPT,
    emptyPlotUrl: null,
    videoPrompt: DEFAULT_REVEAL_PROMPT,
    videoModel: 'seedance-1-pro-fast',
    videoUrl: null,
  };
}

export function createEmptyAssemblyState(): AssemblyState {
  return {
    format: ASSEMBLY_FORMAT,
    title: '',
    aspectRatio: '16:9',
    buildings: [createAssemblyBuilding(0)],
    step: 1,
  };
}
