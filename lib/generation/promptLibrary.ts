/**
 * Centralized Prompt Library
 * All hardcoded prompts used in content generation are defined here
 */

/**
 * Scene Dictionary Prompts
 * Used to determine scene count and purposes
 */
export const SCENE_DICTIONARY_SYSTEM_PROMPT = `You are a Creative Director planning a video content strategy.
  You should develop and pitch innovative concepts for ad campaigns, translating brand strategies into visual narratives for film and video. 
  You should provide inputs for each scene in pre-production tasks, including storyboarding and mood boards.
Your task is to determine how many scenes are needed and what the purpose of each scene should be.
You decide the number of scenes based on the product information and the style of the video.

You MUST output ONLY valid JSON. No markdown, no code fences, no explanations.`;

export function getSceneDictionaryUserPrompt(
  input: {
    productName: string;
    offer?: string;
    features?: string[];
    targetAudience?: string;
    platform?: string;
  },
  sceneGenerationPolicy: { minScenes: number; maxScenes: number },
  availablePurposes: string[]
): string {
  return `Based on the following information, determine the optimal number of scenes (between ${sceneGenerationPolicy.minScenes} and ${sceneGenerationPolicy.maxScenes}) and the purpose of each scene.

Product Information:
- Product: ${input.productName}
- Offer: ${input.offer || 'Not specified'}
- Features: ${input.features?.join(', ') || 'Not specified'}
- Target Audience: ${input.targetAudience || 'General audience'}
- Platform: ${input.platform || 'General'}

Available scene purposes: ${JSON.stringify(availablePurposes)}

Output JSON in this EXACT format:
{
  "sceneCount": <number between ${sceneGenerationPolicy.minScenes} and ${sceneGenerationPolicy.maxScenes}>,
  "scenes": [
    { "index": 1, "purpose": "<purpose from available list>", "execution_input":"your input based on the purpose of the scene, be elaborate and commanding" },
    { "index": 2, "purpose": "<purpose from available list>", "execution_input":"your input based on the purpose of the scene, be elaborate and commanding" },
    ...
  ]
}`;
}

/**
 * Agent Executor Prompts
 */
export function getAgentSystemPrompt(agentName: string, agentRole: string): string {
  return `You are ${agentName}, a ${agentRole} in a multi-department ad production pipeline. You ONLY output valid JSON. No prose, no code fences, no markdown.`;
}

export function getAgentTaskDescription(
  agentRole: string,
  hasInput: boolean,
  hasOtherAgents: boolean
): string {
  if (hasInput && !hasOtherAgents) {
    return `Analyze the product information in the "input" object. Based on your role as ${agentRole}, provide insights, recommendations, or analysis that will help create engaging video content. Be specific and actionable.`;
  } else if (hasInput && hasOtherAgents) {
    return `Review the product information in "input" and any previous agent contributions. As ${agentRole}, synthesize this information and add your expert perspective to improve the video content strategy.`;
  }
  return 'Analyze the shared state and produce your output.';
}

export function getSceneSpecificGuidance(
  scenePurpose: string,
  sceneIndex: number | string,
  sceneGoal?: string
): string {
  return `
  
CURRENT SCENE CONTEXT:
You are generating content for Scene ${sceneIndex} with purpose: "${scenePurpose}"
${sceneGoal ? `Scene Goal: ${sceneGoal}` : ''}

CRITICAL: Focus your recommendations specifically on this scene's purpose ("${scenePurpose}"). 
Your output should be tailored to help create the image prompt for THIS specific scene.
`;
}

export function getFinalAgentPrompt(
  agentName: string,
  agentRole: string,
  sceneIndex: number | string,
  scenePurpose: string,
  visibleState: Record<string, any>,
  limits: {
    imagePromptMaxChars: number;
    negativesMaxChars: number;
    maxWordsOnScreenText: number;
  },
  cameraPresets: string[]
): string {
  return `Shared state (JSON):
${JSON.stringify(visibleState, null, 2)}

CRITICAL - YOU ARE THE FINAL AD PROJECT MANAGER AGENT:
ABSOLUTE VISUAL RULE:
Describe ONE single still image only.
No motion, no action verbs, no transitions, no before/after, no cinematic progression.
The image must represent a frozen moment that can exist as a photograph.
Do NOT imply video, movement, or time passing.
Ensure no particular color, style, details is mentioned in a product unless mentioned
Ensure that the final prompt says to preserve the details of the attached reference image as the last line.
You must synthesize ALL previous agent contributions and create the final imagePrompt for Scene ${sceneIndex} with purpose: "${scenePurpose}".

Your task as ${agentName} (${agentRole}):
1. Review ALL previous agent outputs in the shared state
2. Synthesize their insights into a comprehensive imagePrompt
3. Create a detailed, specific image description that combines:
   - Product details from input
   - All insights from previous agents (check shared state for agent outputs)
   - Scene-specific requirements for "${scenePurpose}"
   - Visual style, colors, lighting, composition, setting

Your output MUST be a JSON object with these EXACT keys:
{
  "imagePrompt": "<comprehensive, detailed image description>",
  "negativePrompt": "<what to avoid in the image - required, max ${limits.negativesMaxChars} chars>",
  "camera": {
    "shot": "<one of: ${JSON.stringify(cameraPresets)}>",
    "lens": "<optional>",
    "movement": "<optional>"
  },
  "environment": {
    "location": "<consistent or based on the scene purpose>",
    "timeOfDay": "<consistent or based on the scene purpose>",
    "lighting": "<consistent or based on the scene purpose>"
  },
  "onScreenText": {
    "text": "<optional, max ${limits.maxWordsOnScreenText} words>",
    "styleNotes": "<Must provide>"
  },
  "compositionNotes": "<must provide>"
}

The imagePrompt should:
- Be As detailed as possible dont worry about characters count (use the FULL limit)
- prioritize and merge product features mentioned
- prioritize and merge visual elements from previous agents
- prioritize and merge lighting and atmosphere suggestions
- prioritize and merge composition ideas
- prioritize and merge setting and context details
- prioritize and merge emotional elements
- Be specific and detailed, not generic

Constraints:
- No markdown, no headings, no bullet points
- Output ONLY valid JSON
- imagePrompt must be renderer-ready, not an explanation`;
}

export function getRegularAgentPrompt(
  agentName: string,
  agentRole: string,
  taskDescription: string,
  sceneSpecificGuidance: string,
  scenePurpose: string | undefined,
  sceneIndex: number | string | undefined,
  visibleState: Record<string, any>,
  writesToKeys: string[]
): string {
  return `Shared state (JSON):
${JSON.stringify(visibleState, null, 2)}

Your task as ${agentName} (${agentRole}):
${taskDescription}
${sceneSpecificGuidance}

IMPORTANT:
- The "input" object contains product details: productName, offer, features, targetAudience, platform, etc.
- ${scenePurpose ? `You are working on Scene ${sceneIndex || '?'} with purpose: "${scenePurpose}"` : 'Analyze the product information'}
- Analyze this information thoroughly based on your role
- Provide specific, actionable insights relevant to your expertise
- If you see previous agent outputs, build upon them
${scenePurpose ? `- Focus your recommendations on the "${scenePurpose}" scene purpose` : ''}

Output JSON with exactly these top-level keys:
${JSON.stringify(writesToKeys)}

Each key should contain structured data relevant to your role. For example:
- If you're a fashion expert: provide style insights, color recommendations, target audience analysis
- If you're a copywriter: provide messaging ideas, taglines, key phrases
- If you're a visual stylist: provide visual direction, composition ideas, mood suggestions
${scenePurpose ? `- Tailor all recommendations specifically for the "${scenePurpose}" scene` : ''}

Constraints:
- All strings must be concise and specific
- No markdown, no headings, no bullet points
- Output ONLY valid JSON
- Provide actual analysis, not "No data to analyze"`;
}

/**
 * Single-Prompt Generation (Fallback)
 * Used when no agent workflow is configured
 */
export function getSinglePromptGenerationUserPrompt(
  sceneCount: number,
  goal: string,
  platform: string,
  language: string,
  tone: string,
  subjectType: string,
  subjectName: string,
  productInfo: string,
  storyInfo: string,
  offerText: string,
  audienceDesc: string,
  contentType: {
    sceneGenerationPolicy: {
      minScenes: number;
      maxScenes: number;
      rules?: {
        mustStartStrong?: boolean;
        mustEndWithClosure?: boolean;
        avoidRepetition?: boolean;
        platformAwareOrdering?: boolean;
      };
    };
    outputContract: {
      globalDefaults: {
        defaultAspectRatio: string;
        visualStylePreset: string;
        durationPerSceneSeconds: number;
      };
    };
  }
): string {
  return `Generate a ${sceneCount}-scene video content plan based on the following:

CONTENT GOAL: ${goal}
PLATFORM: ${platform}
LANGUAGE: ${language}
${tone ? `TONE: ${tone}` : ''}

SUBJECT:
- Type: ${subjectType}
- Name: ${subjectName}
${productInfo}
${storyInfo}

${offerText ? `OFFER: ${offerText}` : ''}
${audienceDesc ? `TARGET AUDIENCE: ${audienceDesc}` : ''}

OUTPUT REQUIREMENTS:
- Format: storyboard_v1
- Scene Count: ${sceneCount} (between ${contentType.sceneGenerationPolicy.minScenes} and ${contentType.sceneGenerationPolicy.maxScenes})
- Aspect Ratio: ${contentType.outputContract.globalDefaults.defaultAspectRatio}
- Visual Style: ${contentType.outputContract.globalDefaults.visualStylePreset}
- Duration per Scene: ${contentType.outputContract.globalDefaults.durationPerSceneSeconds} seconds

SCENE GENERATION RULES:
${contentType.sceneGenerationPolicy.rules?.mustStartStrong ? '- First scene must start strong (hook-like opening)' : ''}
${contentType.sceneGenerationPolicy.rules?.mustEndWithClosure ? '- Last scene must end with closure (CTA, payoff, conclusion)' : ''}
${contentType.sceneGenerationPolicy.rules?.avoidRepetition ? '- Avoid repetition in purpose, shot, or location' : ''}
${contentType.sceneGenerationPolicy.rules?.platformAwareOrdering ? '- Order scenes appropriately for the platform' : ''}

Generate a JSON response with this EXACT structure:
{
  "scenes": [
    {
      "id": "scene-1",
      "purpose": "<dynamically determined purpose based on goal and context>",
      "imagePrompt": "<detailed visual description for image generation, very specific and comprehensive>",
      "negativePrompt": "<what to avoid in the image(required)>",
      "camera": {
        "shot": "<camera shot type>",
        "lens": "<lens type>",
        "movement": "<camera movement>"
      },
      "environment": {
        "location": "<location description>",
        "timeOfDay": "<time of day>",
        "lighting": "<lighting description>"
      },
      "onScreenText": {
        "text": "<optional text overlay>",
        "styleNotes": "<style notes for text>"
      },
      "compositionNotes": "<optional composition notes>"
    },
    ... (exactly ${sceneCount} scenes)
  ],
  "textOverlaySuggestions": ["<suggestion 1>", "<suggestion 2>", ...],
  "thumbnailPrompt": "<detailed prompt for thumbnail generation>"
}

CRITICAL: 
- Return ONLY valid JSON. No markdown, no code blocks, no explanations.
- Each scene MUST have a unique purpose that fits the goal and context.
- imagePrompt should be detailed and specific (aim for 200-500 characters).
- Scene purposes should be dynamic and context-appropriate, not hardcoded.
- Ensure scene purposes vary and create a logical flow for the ${goal} goal.
`;
}

