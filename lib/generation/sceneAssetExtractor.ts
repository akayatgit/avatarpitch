import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export type SceneAssetType = 'cast' | 'object' | 'environment';

export interface ExtractedSceneAssets {
  sceneIndex: number;
  casts: string[];
  objects: string[];
  environments: string[];
}

export interface AssetRequirement {
  id: string;
  type: SceneAssetType;
  label: string;
  sceneIndices: number[];
}

export interface SceneAssetRequirements {
  sceneIndex: number;
  assetIds: string[];
}

export interface AssetExtractionResult {
  assets: AssetRequirement[];
  scenes: SceneAssetRequirements[];
}

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

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAssetId(type: SceneAssetType, label: string): string {
  const slug = normalizeLabel(label).replace(/\s+/g, '-');
  return `${type}:${slug}`;
}

function isMeaningfulLabel(value: string): boolean {
  const normalized = normalizeLabel(value);
  return (
    normalized.length > 0 &&
    !['none', 'n/a', 'na', 'unspecified', 'unknown', 'not specified'].includes(normalized)
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = normalizeLabel(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(value.trim());
  }
  return unique;
}

export async function extractSceneAssets(scenes: any[]): Promise<AssetExtractionResult> {
  if (!scenes || scenes.length === 0) {
    return { assets: [], scenes: [] };
  }

  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: 0.2,
    openAIApiKey: getApiKey(),
  });

  const simplifiedScenes = scenes.map((scene: any, idx: number) => ({
    sceneIndex: scene.index ?? idx + 1,
    purpose: scene.purpose,
    imagePrompt: scene.imagePrompt,
    environment: scene.environment,
    camera: scene.camera,
    compositionNotes: scene.compositionNotes,
    characters: scene.characters,
    props: scene.props,
  }));

  const systemPrompt = [
    'You extract visual reference requirements from storyboard scenes.',
    'Return ONLY valid JSON with the schema:',
    '{{ "scenes": [ {{ "sceneIndex": number, "casts": string[], "objects": string[], "environments": string[] }} ] }}',
    'Rules:',
    '- casts: people/characters/creatures that need a reference image.',
    '- objects: physical products/props/items that need a reference image.',
    '- environments: physical locations or settings that need a reference image.',
    '- Use short, specific labels; avoid duplicates within a scene.',
    '- If nothing is needed, return empty arrays.',
    '- Output JSON only. No extra text.',
  ].join('\n');

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Scenes:\n${JSON.stringify(simplifiedScenes, null, 2)}`),
  ]);

  let content = typeof response.content === 'string' ? response.content : String(response.content);
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```[a-z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed: { scenes: ExtractedSceneAssets[] } | null = null;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw error;
    }
  }

  const extractedScenes = (parsed?.scenes || []).map((scene) => ({
    sceneIndex: scene.sceneIndex,
    casts: uniqueStrings((scene.casts || []).filter(isMeaningfulLabel)),
    objects: uniqueStrings((scene.objects || []).filter(isMeaningfulLabel)),
    environments: uniqueStrings((scene.environments || []).filter(isMeaningfulLabel)),
  }));

  const assetsMap = new Map<string, AssetRequirement>();
  const sceneRequirements: SceneAssetRequirements[] = [];

  for (const scene of extractedScenes) {
    const sceneAssetIds: string[] = [];
    const addAsset = (type: SceneAssetType, label: string) => {
      if (!isMeaningfulLabel(label)) return;
      const assetId = toAssetId(type, label);
      const existing = assetsMap.get(assetId);
      if (existing) {
        if (!existing.sceneIndices.includes(scene.sceneIndex)) {
          existing.sceneIndices.push(scene.sceneIndex);
        }
      } else {
        assetsMap.set(assetId, {
          id: assetId,
          type,
          label: label.trim(),
          sceneIndices: [scene.sceneIndex],
        });
      }
      sceneAssetIds.push(assetId);
    };

    scene.casts.forEach((label) => addAsset('cast', label));
    scene.objects.forEach((label) => addAsset('object', label));
    scene.environments.forEach((label) => addAsset('environment', label));

    sceneRequirements.push({
      sceneIndex: scene.sceneIndex,
      assetIds: Array.from(new Set(sceneAssetIds)),
    });
  }

  return {
    assets: Array.from(assetsMap.values()),
    scenes: sceneRequirements,
  };
}
