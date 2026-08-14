'use client';

/**
 * Shareable job-links PDF — the companion to the rendered reel.
 *
 * Viewers watching the video comment for links; this PDF is what gets sent to
 * them. It mirrors the reel's arrangement (hook, then one block per job card,
 * then the CTA) with the same theme colors, and each card carries a tappable
 * "Apply here" hyperlink. Generated fully client-side (jsPDF, loaded on
 * demand) — no server, no storage.
 */

import { usableCards, type JobReelCard, type JobReelState } from './jobReel';

type JsPdf = import('jspdf').jsPDF;

// A4 portrait in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  pageBg: [17, 17, 17],
  cardBg: [27, 27, 27],
  white: [255, 255, 255],
  black: [17, 17, 17],
  yellow: [255, 211, 53],
  red: [214, 40, 40],
  lime: [209, 254, 23],
  gray: [156, 163, 175],
} as const;

/** Built-in PDF fonts can't draw emoji — strip them, keep the words. */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface Box {
  text: string;
  fontSize: number;
  textColor: readonly number[];
  boxColor: readonly number[];
  bold?: boolean;
  maxWidth?: number;
}

class PdfBuilder {
  y = MARGIN;

  constructor(private doc: JsPdf) {
    this.paintPage();
  }

  private paintPage() {
    const [r, g, b] = COLORS.pageBg;
    this.doc.setFillColor(r, g, b);
    this.doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  }

  ensureRoom(height: number) {
    if (this.y + height > PAGE_H - MARGIN) {
      this.doc.addPage();
      this.paintPage();
      this.y = MARGIN;
    }
  }

  gap(points: number) {
    this.y += points;
  }

  measureBox(box: Box): { lines: string[]; width: number; height: number } {
    const { fontSize, bold = true } = box;
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(fontSize);
    const maxTextWidth = box.maxWidth ?? CONTENT_W * 0.82;
    const lines = this.doc.splitTextToSize(box.text, maxTextWidth) as string[];
    const textWidth = Math.max(...lines.map((line) => this.doc.getTextWidth(line)), 0);
    const padX = fontSize * 0.9;
    const padY = fontSize * 0.55;
    return {
      lines,
      width: Math.min(textWidth + padX * 2, CONTENT_W),
      height: lines.length * fontSize * 1.35 + padY * 2,
    };
  }

  /** Centered rounded text box, reel-style. */
  drawBox(box: Box) {
    const text = box.text.trim();
    if (!text) return;
    const measured = this.measureBox({ ...box, text });
    this.ensureRoom(measured.height);
    const x = (PAGE_W - measured.width) / 2;
    const [br, bg, bb] = box.boxColor;
    this.doc.setFillColor(br, bg, bb);
    this.doc.roundedRect(x, this.y, measured.width, measured.height, 8, 8, 'F');
    const [tr, tg, tb] = box.textColor;
    this.doc.setTextColor(tr, tg, tb);
    const lineHeight = box.fontSize * 1.35;
    const firstBaseline = this.y + box.fontSize * 0.55 + box.fontSize;
    measured.lines.forEach((line, index) => {
      this.doc.text(line, PAGE_W / 2, firstBaseline + index * lineHeight, { align: 'center' });
    });
    this.y += measured.height;
  }

  /** Centered plain text (no box). */
  drawText(text: string, fontSize: number, color: readonly number[], bold = true) {
    const clean = text.trim();
    if (!clean) return;
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(clean, CONTENT_W) as string[];
    const height = lines.length * fontSize * 1.35;
    this.ensureRoom(height);
    const [r, g, b] = color;
    this.doc.setTextColor(r, g, b);
    lines.forEach((line, index) => {
      this.doc.text(line, PAGE_W / 2, this.y + fontSize + index * fontSize * 1.35, {
        align: 'center',
      });
    });
    this.y += height;
  }

  /** Centered underlined hyperlink. */
  drawLink(label: string, url: string, fontSize: number) {
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(fontSize);
    const width = this.doc.getTextWidth(label);
    const height = fontSize * 1.4;
    this.ensureRoom(height);
    const x = (PAGE_W - width) / 2;
    const baseline = this.y + fontSize;
    const [r, g, b] = COLORS.lime;
    this.doc.setTextColor(r, g, b);
    this.doc.textWithLink(label, x, baseline, { url });
    this.doc.setDrawColor(r, g, b);
    this.doc.setLineWidth(0.8);
    this.doc.line(x, baseline + 2, x + width, baseline + 2);
    this.y += height;
  }

  /** Centered logo image (already a data URL); silently skipped on failure. */
  async drawLogo(dataUrl: string) {
    try {
      if (typeof Image === 'undefined') return;
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('logo load failed'));
        img.src = dataUrl;
      });
      const maxW = 130;
      const maxH = 56;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      const tileW = w + 28;
      const tileH = h + 20;
      this.ensureRoom(tileH);
      this.doc.setFillColor(255, 255, 255);
      this.doc.roundedRect((PAGE_W - tileW) / 2, this.y, tileW, tileH, 8, 8, 'F');
      const format = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      this.doc.addImage(dataUrl, format, (PAGE_W - w) / 2, this.y + 10, w, h);
      this.y += tileH;
    } catch {
      // no logo in the PDF is fine — the company name box still renders
    }
  }
}

async function drawCard(builder: PdfBuilder, card: JobReelCard, index: number) {
  const company = card.company.trim();
  const role = card.role.trim();
  const experience = card.experience.trim();
  const education = card.education.trim();
  const applyUrl = card.applyUrl.trim();

  builder.ensureRoom(120); // keep a card's header from starting at a page's last line
  builder.drawText(`Job ${index + 1}`, 10, COLORS.gray, false);
  builder.gap(6);

  if (card.logoUrl) {
    await builder.drawLogo(card.logoUrl);
    builder.gap(8);
  }
  if (company) {
    builder.drawBox({
      text: company,
      fontSize: 15,
      textColor: COLORS.black,
      boxColor: COLORS.white,
    });
    builder.gap(8);
  }
  for (const [label, value] of [
    ['Role', role],
    ['Experience', experience],
    ['Education', education],
  ] as const) {
    if (!value) continue;
    builder.drawBox({
      text: `${label} : ${value}`,
      fontSize: 11,
      textColor: COLORS.black,
      boxColor: COLORS.yellow,
    });
    builder.gap(8);
  }
  if (applyUrl) {
    builder.gap(2);
    builder.drawLink('Apply here', applyUrl, 13);
    builder.gap(4);
    // The raw link as small text too — survives printing / copy-paste
    const shortUrl = applyUrl.length > 78 ? `${applyUrl.slice(0, 75)}…` : applyUrl;
    builder.drawText(shortUrl, 8, COLORS.gray, false);
  } else {
    builder.drawText('(no apply link on this card)', 9, COLORS.gray, false);
  }
  builder.gap(24);
}

export async function generateJobReelPdfBlob(state: JobReelState): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const builder = new PdfBuilder(doc);

  // Hook — same order as section 1 of the reel
  builder.drawText(stripEmoji(state.hook.banner), 13, COLORS.white);
  builder.gap(10);
  builder.drawBox({
    text: stripEmoji(state.hook.headline),
    fontSize: 22,
    textColor: COLORS.black,
    boxColor: COLORS.white,
  });
  builder.gap(10);
  builder.drawBox({
    text: stripEmoji(state.hook.subtitle),
    fontSize: 11,
    textColor: COLORS.black,
    boxColor: COLORS.yellow,
    maxWidth: CONTENT_W * 0.6,
  });
  builder.gap(10);
  builder.drawBox({
    text: stripEmoji(state.hook.hint),
    fontSize: 12,
    textColor: COLORS.red,
    boxColor: COLORS.white,
  });
  builder.gap(30);

  for (const [index, card] of usableCards(state).entries()) {
    await drawCard(builder, card, index);
  }

  if (state.cta.enabled) {
    builder.gap(6);
    builder.drawText(stripEmoji(state.cta.line1), 12, COLORS.white);
    builder.gap(6);
    builder.drawText(stripEmoji(state.cta.line2), 10, COLORS.gray, false);
    builder.gap(4);
    builder.drawText(stripEmoji(state.cta.line3), 10, COLORS.gray, false);
  }

  return doc.output('blob');
}
