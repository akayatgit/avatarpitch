/**
 * Client-side canvas renderers for the Job Reel section overlays.
 *
 * Each section of the final video is the (dimmed) background video with one
 * full-frame transparent PNG composited on top. These PNGs are rendered in the
 * browser — real fonts + emoji, unlike serverless ffmpeg — and the exact same
 * code powers the on-device live preview, so what you see is what renders.
 */

import {
  JOB_REEL_HEIGHT,
  JOB_REEL_WIDTH,
  type JobReelCard,
  type JobReelCta,
  type JobReelHook,
} from './jobReel';

/** Which elements of the hook are visible (staged reveal in the final video). */
export type HookStage = 'top' | 'full';

const FONT_FAMILY = 'Switzer, system-ui, -apple-system, sans-serif';

/** One template = one look. Every card uses these, so all sections stay uniform. */
const THEME = {
  yellow: '#FFD335',
  white: '#FFFFFF',
  black: '#111111',
  red: '#D62828',
  hookDim: 'rgba(0, 0, 0, 0.35)',
  cardDim: 'rgba(0, 0, 0, 0.55)',
  boxRadius: 14,
} as const;

function createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = JOB_REEL_WIDTH;
  canvas.height = JOB_REEL_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  return { canvas, ctx };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Word-wrap text to maxWidth, honouring explicit newlines. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface TextBoxOptions {
  text: string;
  centerY: number;
  fontSize: number;
  fontWeight?: string;
  textColor: string;
  boxColor: string;
  maxTextWidth?: number;
  paddingX?: number;
  paddingY?: number;
}

/**
 * Draw a centered rounded text box and return its total height.
 * When `centerY` is treated as the top edge, pass the result of measureTextBox.
 */
function drawTextBox(ctx: CanvasRenderingContext2D, options: TextBoxOptions): number {
  const {
    text,
    centerY,
    fontSize,
    fontWeight = 'bold',
    textColor,
    boxColor,
    maxTextWidth = JOB_REEL_WIDTH * 0.78,
    paddingX = 28,
    paddingY = 18,
  } = options;

  ctx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, text, maxTextWidth);
  if (lines.length === 0) return 0;

  const lineHeight = fontSize * 1.3;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxWidth = Math.min(textWidth + paddingX * 2, JOB_REEL_WIDTH * 0.92);
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxX = (JOB_REEL_WIDTH - boxWidth) / 2;
  const boxY = centerY - boxHeight / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = boxColor;
  roundRectPath(ctx, boxX, boxY, boxWidth, boxHeight, THEME.boxRadius);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = textColor;
  const firstLineY = boxY + paddingY + lineHeight / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, JOB_REEL_WIDTH / 2, firstLineY + index * lineHeight);
  });

  return boxHeight;
}

/** Measure the height a text box would take without drawing it. */
function measureTextBox(
  ctx: CanvasRenderingContext2D,
  options: Pick<TextBoxOptions, 'text' | 'fontSize' | 'fontWeight' | 'maxTextWidth' | 'paddingY'>
): number {
  const {
    text,
    fontSize,
    fontWeight = 'bold',
    maxTextWidth = JOB_REEL_WIDTH * 0.78,
    paddingY = 18,
  } = options;
  ctx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
  const lines = wrapText(ctx, text, maxTextWidth);
  if (lines.length === 0) return 0;
  return lines.length * fontSize * 1.3 + paddingY * 2;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the logo image'));
    image.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* Section 1 — hook overlay                                            */
/* ------------------------------------------------------------------ */

function drawHookOverlay(ctx: CanvasRenderingContext2D, hook: JobReelHook, stage: HookStage) {
  // Dim baked into the overlay so ffmpeg only has to composite one PNG
  ctx.fillStyle = THEME.hookDim;
  ctx.fillRect(0, 0, JOB_REEL_WIDTH, JOB_REEL_HEIGHT);

  const banner = hook.banner.trim();
  const headline = hook.headline.trim();
  const subtitle = hook.subtitle.trim();
  const hint = hook.hint.trim();
  // 'top' shows only banner + headline, but the layout is measured with ALL
  // blocks so nothing shifts when the subtitle + hint pop in mid-section
  const showRest = stage === 'full';

  const GAP = 64;

  // Measure the full stack so it centers in the upper 2/3 of the frame
  const bannerHeight = banner ? 52 : 0;
  const headlineHeight = headline
    ? measureTextBox(ctx, { text: headline, fontSize: 64, paddingY: 26 })
    : 0;
  const subtitleHeight = subtitle
    ? measureTextBox(ctx, { text: subtitle, fontSize: 32, maxTextWidth: 480, paddingY: 22 })
    : 0;
  const hintHeight = hint ? measureTextBox(ctx, { text: hint, fontSize: 36 }) : 0;

  const blocks = [bannerHeight, headlineHeight, subtitleHeight, hintHeight].filter((h) => h > 0);
  const stackHeight =
    blocks.reduce((sum, h) => sum + h, 0) + Math.max(0, blocks.length - 1) * GAP;
  let cursorY = Math.max(120, (JOB_REEL_HEIGHT * 0.72 - stackHeight) / 2 + 90);

  if (banner) {
    ctx.font = `bold 40px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = THEME.white;
    ctx.fillText(banner, JOB_REEL_WIDTH / 2, cursorY + bannerHeight / 2, JOB_REEL_WIDTH * 0.9);
    ctx.restore();
    cursorY += bannerHeight + GAP;
  }

  if (headline) {
    drawTextBox(ctx, {
      text: headline,
      centerY: cursorY + headlineHeight / 2,
      fontSize: 64,
      textColor: THEME.black,
      boxColor: THEME.white,
      paddingY: 26,
    });
    cursorY += headlineHeight + GAP;
  }

  if (subtitle) {
    if (showRest) {
      drawTextBox(ctx, {
        text: subtitle,
        centerY: cursorY + subtitleHeight / 2,
        fontSize: 32,
        textColor: THEME.black,
        boxColor: THEME.yellow,
        maxTextWidth: 480,
        paddingY: 22,
      });
    }
    cursorY += subtitleHeight + GAP;
  }

  if (hint && showRest) {
    drawTextBox(ctx, {
      text: hint,
      centerY: cursorY + hintHeight / 2,
      fontSize: 36,
      textColor: THEME.red,
      boxColor: THEME.white,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Final section — CTA overlay                                         */
/* ------------------------------------------------------------------ */

function drawCtaOverlay(ctx: CanvasRenderingContext2D, cta: JobReelCta) {
  ctx.fillStyle = THEME.cardDim;
  ctx.fillRect(0, 0, JOB_REEL_WIDTH, JOB_REEL_HEIGHT);

  const line1 = cta.line1.trim();
  const line2 = cta.line2.trim();
  const line3 = cta.line3.trim();

  const GAP = 56;
  const h1 = line1
    ? measureTextBox(ctx, { text: line1, fontSize: 46, maxTextWidth: 520, paddingY: 26 })
    : 0;
  const h2 = line2
    ? measureTextBox(ctx, { text: line2, fontSize: 34, maxTextWidth: 500, paddingY: 22 })
    : 0;
  const h3 = line3 ? measureTextBox(ctx, { text: line3, fontSize: 34, maxTextWidth: 500 }) : 0;

  const blocks = [h1, h2, h3].filter((h) => h > 0);
  const stackHeight = blocks.reduce((sum, h) => sum + h, 0) + Math.max(0, blocks.length - 1) * GAP;
  let cursorY = (JOB_REEL_HEIGHT - stackHeight) / 2;

  if (line1) {
    drawTextBox(ctx, {
      text: line1,
      centerY: cursorY + h1 / 2,
      fontSize: 46,
      textColor: THEME.black,
      boxColor: THEME.white,
      maxTextWidth: 520,
      paddingY: 26,
    });
    cursorY += h1 + GAP;
  }
  if (line2) {
    drawTextBox(ctx, {
      text: line2,
      centerY: cursorY + h2 / 2,
      fontSize: 34,
      textColor: THEME.black,
      boxColor: THEME.yellow,
      maxTextWidth: 500,
      paddingY: 22,
    });
    cursorY += h2 + GAP;
  }
  if (line3) {
    drawTextBox(ctx, {
      text: line3,
      centerY: cursorY + h3 / 2,
      fontSize: 34,
      textColor: THEME.red,
      boxColor: THEME.white,
      maxTextWidth: 500,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Sections 2..N — job card overlay                                    */
/* ------------------------------------------------------------------ */

export interface LogoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draw the job card overlay. With `includeLogo: false` the logo tile is left
 * out (its space is preserved) and its frame position is returned, so the
 * render pipeline can animate the logo in as a separate layer.
 */
async function drawJobCardOverlay(
  ctx: CanvasRenderingContext2D,
  card: JobReelCard,
  includeLogo = true
): Promise<{ logo: HTMLImageElement | null; logoRect: LogoRect | null }> {
  ctx.fillStyle = THEME.cardDim;
  ctx.fillRect(0, 0, JOB_REEL_WIDTH, JOB_REEL_HEIGHT);

  const company = card.company.trim();
  const role = card.role.trim();
  const experience = card.experience.trim();
  const education = card.education.trim();

  let logo: HTMLImageElement | null = null;
  if (card.logoUrl) {
    try {
      logo = await loadImage(card.logoUrl);
    } catch {
      logo = null; // fall back to the company name text box
    }
  }

  const GAP = 34;
  const LOGO_BOX_WIDTH = 340;
  const LOGO_BOX_HEIGHT = 170;

  const rows: Array<{ kind: 'logo' } | { kind: 'box'; options: TextBoxOptions; height: number }> =
    [];

  if (logo) {
    rows.push({ kind: 'logo' });
  } else if (company) {
    const options: TextBoxOptions = {
      text: company,
      centerY: 0,
      fontSize: 52,
      textColor: THEME.black,
      boxColor: THEME.white,
      paddingY: 24,
    };
    rows.push({ kind: 'box', options, height: measureTextBox(ctx, options) });
  }

  const detailRows: Array<[string, string, number]> = [
    ['Role', role, 36],
    ['Experience', experience, 30],
    ['Education', education, 28],
  ];
  for (const [label, value, fontSize] of detailRows) {
    if (!value) continue;
    const options: TextBoxOptions = {
      text: `${label} : ${value}`,
      centerY: 0,
      fontSize,
      textColor: THEME.black,
      boxColor: THEME.yellow,
      maxTextWidth: 520,
      paddingY: 20,
    };
    rows.push({ kind: 'box', options, height: measureTextBox(ctx, options) });
  }

  const stackHeight = rows.reduce(
    (sum, row) => sum + (row.kind === 'logo' ? LOGO_BOX_HEIGHT : row.height),
    0
  );
  const totalHeight = stackHeight + Math.max(0, rows.length - 1) * GAP;
  let cursorY = (JOB_REEL_HEIGHT - totalHeight) / 2;
  let logoRect: LogoRect | null = null;

  for (const row of rows) {
    if (row.kind === 'logo' && logo) {
      const boxX = (JOB_REEL_WIDTH - LOGO_BOX_WIDTH) / 2;
      logoRect = { x: boxX, y: cursorY, width: LOGO_BOX_WIDTH, height: LOGO_BOX_HEIGHT };
      if (includeLogo) {
        drawLogoTile(ctx, logo, boxX, cursorY, LOGO_BOX_WIDTH, LOGO_BOX_HEIGHT);
      }
      cursorY += LOGO_BOX_HEIGHT + GAP;
    } else if (row.kind === 'box') {
      drawTextBox(ctx, { ...row.options, centerY: cursorY + row.height / 2 });
      cursorY += row.height + GAP;
    }
  }

  return { logo, logoRect };
}

/** The white rounded tile with the logo fitted inside — one drawing, two uses. */
function drawLogoTile(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = THEME.white;
  roundRectPath(ctx, x, y, width, height, THEME.boxRadius);
  ctx.fill();
  ctx.restore();

  // Fit the logo inside the white box with padding, preserving aspect ratio
  const pad = 24;
  const maxW = width - pad * 2;
  const maxH = height - pad * 2;
  const scale = Math.min(maxW / logo.width, maxH / logo.height);
  const drawW = logo.width * scale;
  const drawH = logo.height * scale;
  ctx.drawImage(logo, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Hook overlay — 'top' (banner + headline) or 'full' (everything). */
export function renderHookOverlayDataUrl(hook: JobReelHook, stage: HookStage = 'full'): string {
  const { canvas, ctx } = createCanvas();
  drawHookOverlay(ctx, hook, stage);
  return canvas.toDataURL('image/png');
}

/** Full composite card — used for the live previews in the wizard. */
export async function renderJobCardOverlayDataUrl(card: JobReelCard): Promise<string> {
  const { canvas, ctx } = createCanvas();
  await drawJobCardOverlay(ctx, card, true);
  return canvas.toDataURL('image/png');
}

/** CTA overlay — final like/follow/comment section. */
export function renderCtaOverlayDataUrl(cta: JobReelCta): string {
  const { canvas, ctx } = createCanvas();
  drawCtaOverlay(ctx, cta);
  return canvas.toDataURL('image/png');
}

export interface JobCardRenderParts {
  /** Card overlay WITHOUT the logo tile (its space is preserved). */
  overlayDataUrl: string;
  /** Separate logo tile layer for the ffmpeg pop-in animation. */
  logo: { dataUrl: string; x: number; y: number } | null;
}

/** Margin around the logo tile canvas so its drop shadow isn't clipped. */
const LOGO_TILE_MARGIN = 30;

/**
 * Render the two layers of a job card section: the static overlay (sans logo)
 * and the logo tile as its own small PNG with frame coordinates, so the server
 * can animate the logo in with easing.
 */
export async function renderJobCardParts(card: JobReelCard): Promise<JobCardRenderParts> {
  const { canvas, ctx } = createCanvas();
  const { logo, logoRect } = await drawJobCardOverlay(ctx, card, false);
  const overlayDataUrl = canvas.toDataURL('image/png');

  if (!logo || !logoRect) {
    return { overlayDataUrl, logo: null };
  }

  const tile = document.createElement('canvas');
  tile.width = logoRect.width + LOGO_TILE_MARGIN * 2;
  tile.height = logoRect.height + LOGO_TILE_MARGIN * 2;
  const tileCtx = tile.getContext('2d');
  if (!tileCtx) {
    return { overlayDataUrl, logo: null };
  }
  drawLogoTile(tileCtx, logo, LOGO_TILE_MARGIN, LOGO_TILE_MARGIN, logoRect.width, logoRect.height);

  return {
    overlayDataUrl,
    logo: {
      dataUrl: tile.toDataURL('image/png'),
      x: logoRect.x - LOGO_TILE_MARGIN,
      y: logoRect.y - LOGO_TILE_MARGIN,
    },
  };
}
