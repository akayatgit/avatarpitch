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
  type JobReelHook,
} from './jobReel';

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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to render the overlay'))),
      'image/png'
    );
  });
}

/* ------------------------------------------------------------------ */
/* Section 1 — hook overlay                                            */
/* ------------------------------------------------------------------ */

function drawHookOverlay(ctx: CanvasRenderingContext2D, hook: JobReelHook) {
  // Dim baked into the overlay so ffmpeg only has to composite one PNG
  ctx.fillStyle = THEME.hookDim;
  ctx.fillRect(0, 0, JOB_REEL_WIDTH, JOB_REEL_HEIGHT);

  const banner = hook.banner.trim();
  const headline = hook.headline.trim();
  const subtitle = hook.subtitle.trim();
  const hint = hook.hint.trim();

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
    drawTextBox(ctx, {
      text: subtitle,
      centerY: cursorY + subtitleHeight / 2,
      fontSize: 32,
      textColor: THEME.black,
      boxColor: THEME.yellow,
      maxTextWidth: 480,
      paddingY: 22,
    });
    cursorY += subtitleHeight + GAP;
  }

  if (hint) {
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
/* Sections 2..N — job card overlay                                    */
/* ------------------------------------------------------------------ */

async function drawJobCardOverlay(ctx: CanvasRenderingContext2D, card: JobReelCard) {
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

  for (const row of rows) {
    if (row.kind === 'logo' && logo) {
      const boxX = (JOB_REEL_WIDTH - LOGO_BOX_WIDTH) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = THEME.white;
      roundRectPath(ctx, boxX, cursorY, LOGO_BOX_WIDTH, LOGO_BOX_HEIGHT, THEME.boxRadius);
      ctx.fill();
      ctx.restore();

      // Fit the logo inside the white box with padding, preserving aspect ratio
      const pad = 24;
      const maxW = LOGO_BOX_WIDTH - pad * 2;
      const maxH = LOGO_BOX_HEIGHT - pad * 2;
      const scale = Math.min(maxW / logo.width, maxH / logo.height);
      const drawW = logo.width * scale;
      const drawH = logo.height * scale;
      ctx.drawImage(
        logo,
        (JOB_REEL_WIDTH - drawW) / 2,
        cursorY + (LOGO_BOX_HEIGHT - drawH) / 2,
        drawW,
        drawH
      );
      cursorY += LOGO_BOX_HEIGHT + GAP;
    } else if (row.kind === 'box') {
      drawTextBox(ctx, { ...row.options, centerY: cursorY + row.height / 2 });
      cursorY += row.height + GAP;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function renderHookOverlayBlob(hook: JobReelHook): Promise<Blob> {
  const { canvas, ctx } = createCanvas();
  drawHookOverlay(ctx, hook);
  return canvasToBlob(canvas);
}

export async function renderJobCardOverlayBlob(card: JobReelCard): Promise<Blob> {
  const { canvas, ctx } = createCanvas();
  await drawJobCardOverlay(ctx, card);
  return canvasToBlob(canvas);
}

/** Data-URL variants used for the live previews in the wizard. */
export function renderHookOverlayDataUrl(hook: JobReelHook): string {
  const { canvas, ctx } = createCanvas();
  drawHookOverlay(ctx, hook);
  return canvas.toDataURL('image/png');
}

export async function renderJobCardOverlayDataUrl(card: JobReelCard): Promise<string> {
  const { canvas, ctx } = createCanvas();
  await drawJobCardOverlay(ctx, card);
  return canvas.toDataURL('image/png');
}
