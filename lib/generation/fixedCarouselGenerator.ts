import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ContentTypeDefinition } from '../schemas';

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  return apiKey;
}

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export interface FixedCarouselResult {
  scenes: any[];
  sceneReferenceImageUrls: Record<string, string[]>;
  caption: string;
}

/** Resolve a content type field's label from its key (fixedCarousel config references fields by key). */
function getFieldLabel(contentType: ContentTypeDefinition, key: string): string {
  const field = contentType.inputsContract.fields.find((f) => f.key === key);
  return field ? field.label : key;
}

/** Fill {{Label}} placeholders in a template from a flat label->value data map. */
function fillTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, rawKey) => {
    const key = rawKey.trim();
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

function toStringArray(value: any): string[] {
  if (Array.isArray(value)) return value.map((v) => (v == null ? '' : String(v).trim()));
  if (value == null || value === '') return [];
  return [String(value).trim()];
}

function isMeaningful(value: string | undefined | null): boolean {
  return !!value && value.trim().length > 0;
}

/**
 * Deterministically builds "1 hook + N item + 1 CTA" scenes for a fixed-carousel content type.
 * No LLM decides scene count or layout — every slide of the same type shares an identical
 * template, so visual style never drifts between generations or between items.
 */
export async function generateFixedCarouselScenes(
  contentType: ContentTypeDefinition,
  dynamicInputs: Record<string, any>
): Promise<FixedCarouselResult> {
  const config = (contentType.prompting as any)?.fixedCarousel;
  if (!config) {
    throw new Error(
      `Content type "${contentType.name}" has sceneGenerationPolicy.mode = "fixed_carousel" but no prompting.fixedCarousel config.`
    );
  }

  const maxItems = config.maxItems || 10;

  // Build per-item rows keyed by field label, matched by array index across all item fields.
  const itemLabels: string[] = config.itemFieldKeys.map((key: string) => getFieldLabel(contentType, key));
  const itemArrays: string[][] = itemLabels.map((label) => toStringArray(dynamicInputs[label]));
  const rowCount = Math.min(maxItems, Math.max(0, ...itemArrays.map((a) => a.length)));

  const primaryLabel = itemLabels[0];
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, string> = {};
    itemLabels.forEach((label, idx) => {
      row[label] = itemArrays[idx][i] || '';
    });
    if (isMeaningful(row[primaryLabel])) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new Error('No items found to build the carousel. Please provide at least one row of data.');
  }

  // Flat scalar inputs (hook/CTA fields) keyed by label, as strings for template filling.
  const scalarData: Record<string, string> = {};
  for (const [label, value] of Object.entries(dynamicInputs)) {
    if (!itemLabels.includes(label)) {
      scalarData[label] = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
    }
  }

  const footer = config.footerText || '';
  const scenes: any[] = [];
  const sceneReferenceImageUrls: Record<string, string[]> = {};

  // --- Scene 1: Hook ---
  const hookLogoLabel = config.hookLogoFieldKey ? getFieldLabel(contentType, config.hookLogoFieldKey) : null;
  const hookLogoUrl = hookLogoLabel ? dynamicInputs[hookLogoLabel] : null;
  const hookPrompt = fillTemplate(config.hookPromptTemplate, { ...scalarData, footer });
  scenes.push({
    id: 'scene-1',
    index: 1,
    purpose: 'Hook slide',
    imagePrompt: hookPrompt,
    negativePrompt: '',
    camera: {},
    environment: {},
    onScreenText: {},
    compositionNotes: '',
  });
  if (isMeaningful(hookLogoUrl)) {
    sceneReferenceImageUrls['1'] = [String(hookLogoUrl).trim()];
  }

  // --- Scenes 2..N+1: one per item ---
  const itemLogoLabel = config.itemLogoFieldKey ? getFieldLabel(contentType, config.itemLogoFieldKey) : null;
  rows.forEach((row, idx) => {
    const sceneIndex = idx + 2;
    const itemPrompt = fillTemplate(config.itemPromptTemplate, { ...row, footer });
    scenes.push({
      id: `scene-${sceneIndex}`,
      index: sceneIndex,
      purpose: `Item slide: ${row[primaryLabel]}`,
      imagePrompt: itemPrompt,
      negativePrompt: '',
      camera: {},
      environment: {},
      onScreenText: {},
      compositionNotes: '',
    });
    const logoUrl = itemLogoLabel ? row[itemLogoLabel] : null;
    if (isMeaningful(logoUrl)) {
      sceneReferenceImageUrls[String(sceneIndex)] = [String(logoUrl).trim()];
    }
  });

  // --- Final scene: CTA ---
  const ctaIndex = rows.length + 2;
  const ctaPrompt = fillTemplate(config.ctaPromptTemplate, { ...scalarData, footer });
  scenes.push({
    id: `scene-${ctaIndex}`,
    index: ctaIndex,
    purpose: 'Call to action slide',
    imagePrompt: ctaPrompt,
    negativePrompt: '',
    camera: {},
    environment: {},
    onScreenText: {},
    compositionNotes: '',
  });

  const caption = await generateCaption(rows, itemLabels, primaryLabel, footer);

  return { scenes, sceneReferenceImageUrls, caption };
}

/**
 * Single lightweight "Copywriter" agent call — the only LLM step in this pipeline.
 * Drafts a ready-to-paste Instagram caption listing every item, matching the footer's promise.
 */
async function generateCaption(
  rows: Record<string, string>[],
  itemLabels: string[],
  primaryLabel: string,
  footer: string
): Promise<string> {
  try {
    const llm = new ChatOpenAI({
      modelName: getModel(),
      temperature: 0.6,
      openAIApiKey: getApiKey(),
    });

    const itemsText = rows
      .map((row, idx) => {
        const parts = itemLabels.map((label) => `${label}: ${row[label] || 'N/A'}`).join(' | ');
        return `${idx + 1}. ${parts}`;
      })
      .join('\n');

    const systemPrompt =
      'You are a copywriter who writes short, high-engagement Instagram captions for a recruiting/job-alert page. ' +
      'Write plain text only (no markdown), use relevant emojis sparingly, and keep it scannable with line breaks.';

    const userPrompt = `Write an Instagram caption for a carousel post listing these openings:\n\n${itemsText}\n\nRequirements:\n- Open with a scroll-stopping hook line about these openings.\n- List each item briefly (title + key detail) in a scannable format.\n- End with this exact call-to-action, on its own lines, verbatim:\n${footer}\n- Keep total length under 900 characters.\n- Output ONLY the caption text.`;

    const response = await llm.invoke([new SystemMessage(systemPrompt), new HumanMessage(userPrompt)]);
    let content = typeof response.content === 'string' ? response.content : String(response.content);
    content = content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
    }
    return content;
  } catch (error) {
    console.error('[fixedCarouselGenerator] Caption generation failed, using fallback:', error);
    const fallbackList = rows
      .map((row, idx) => `${idx + 1}. ${row[primaryLabel] || 'Opening'}`)
      .join('\n');
    return `New openings just dropped! 🚨\n\n${fallbackList}\n\n${footer}`;
  }
}
