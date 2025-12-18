import { executeAgent, AgentWorkflow, AgentDefinition } from './agents';
import { GeneratedProjectSchema, TemplateConfig } from './schemas';
import { ChatOpenAI } from '@langchain/openai';

interface GenerateScenesInput {
  templateConfig: TemplateConfig;
  productName: string;
  productLink?: string;
  offer?: string;
  features?: string[];
  targetAudience?: string;
  platform?: 'TikTok' | 'Reels' | 'Shorts';
}

// Video language keywords to reject
const VIDEO_LANGUAGE_KEYWORDS = [
  'pan', 'zoom', 'transition', 'montage', 'cut', 'voiceover', 'music', 'beat',
  'scene structure', 'objective', 'recommendations', '###', 'heading', 'bullet'
];

function containsVideoLanguage(text: string): boolean {
  const lowerText = text.toLowerCase();
  return VIDEO_LANGUAGE_KEYWORDS.some(keyword => lowerText.includes(keyword));
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

export async function generateScenesWithAgents(
  input: GenerateScenesInput
): Promise<{ scenes: any[]; renderingSpec: any }> {
  const { templateConfig, productName, productLink, offer, features, targetAudience, platform } = input;

  const sceneCount = templateConfig.output.sceneCount;
  const renderTarget = templateConfig.output.renderTarget || 'video';
  const isImageFirst = renderTarget === 'image_first_frame';
  
  const limits = templateConfig.output.limits || {
    imagePromptMaxChars: 1000, // Increased to allow very comprehensive prompts
    cameraMaxChars: 90,
    negativesMaxChars: 160,
    maxSentencesImagePrompt: 20, // Increased to allow very detailed descriptions
    maxWordsOnScreenText: 6,
  };
  
  const cameraPresets = templateConfig.output.cameraPresets || [
    'CU handheld face',
    'MS handheld',
    'WS establishing',
    'Top-down product',
    'Product macro',
    'Over-shoulder phone',
    'Mirror shot',
    'Shelf product hero',
    'Lifestyle walk-by',
    'Flatlay'
  ];

  // Check if workflow uses agents
  const workflow = templateConfig.workflow as any;
  const hasAgentWorkflow = workflow.agentWorkflow;

  if (!hasAgentWorkflow) {
    throw new Error('Agent workflow not configured. Please use workflow editor to configure agents.');
  }

  const agentWorkflow: AgentWorkflow = workflow.agentWorkflow;
  const shotLibrary = workflow.shotLibrary || workflow.sceneBlueprint || [];
  const constraints = workflow.constraints || [];
  
  // Add image-first constraints if needed
  if (isImageFirst) {
    constraints.push(
      'Output is IMAGE prompts for the FIRST FRAME only (no motion/editing instructions)',
      'Never use headings (###), Objective, Key Elements, Recommendations, or bullet lists in any field.',
      'imagePrompt must be renderer-ready, not an explanation.'
    );
  }

  // Initialize shared state
  const sharedState: Record<string, any> = {
    input: {
      productName,
      productLink: productLink || 'Not provided',
      offer: offer || 'Not specified',
      features: features || [],
      targetAudience: targetAudience || 'General audience',
      platform: platform || 'General',
      templateOutput: {
        sceneCount,
        minSceneSeconds: templateConfig.output.minSceneSeconds,
        maxSceneSeconds: templateConfig.output.maxSceneSeconds,
        aspectRatio: templateConfig.output.aspectRatio,
        style: templateConfig.output.style,
      },
      shotLibrary,
      constraints,
      cameraPresets,
      limits,
    },
    // Store agent metadata for final assembler
    _agentMetadata: agentWorkflow.agents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      order: a.order,
    })),
  };

  // Sort agents by order
  const sortedAgents = [...agentWorkflow.agents].sort((a, b) => a.order - b.order);

  // Track agent contributions for debugging/transparency
  const agentContributions: Array<{
    agentId: string;
    agentName: string;
    agentRole: string;
    order: number;
    input: Record<string, any>;
    output: Record<string, any>;
    writesTo: string[];
  }> = [];

  // Execute agents sequentially (shared state workflow)
  for (const agent of sortedAgents) {
    // Build visible state from readsFrom
    const visibleState: Record<string, any> = {};
    if (agent.readsFrom && agent.readsFrom.length > 0) {
      agent.readsFrom.forEach(key => {
        if (sharedState[key] !== undefined) {
          visibleState[key] = sharedState[key];
        }
      });
    } else if (agent.inputFrom && agent.inputFrom.length > 0) {
      // Legacy support: use inputFrom to read from previous agent outputs
      agent.inputFrom.forEach(agentId => {
        if (sharedState[agentId] !== undefined) {
          visibleState[agentId] = sharedState[agentId];
        }
      });
      // Also include input for context
      if (sharedState.input) {
        visibleState.input = sharedState.input;
      }
    } else {
      // Default: read ALL shared state (not just input)
      Object.keys(sharedState).forEach(key => {
        visibleState[key] = sharedState[key];
      });
    }

    // Execute agent with scene-specific context
    const agentOutput = await executeAgentWithSharedState(agent, visibleState, limits, cameraPresets, shotLibrary);
    
    // Track agent contribution
    const writesToKeys = agent.writesTo || (agent.outputTo ? [agent.id] : [agent.id]);
    agentContributions.push({
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      order: agent.order,
      input: { ...visibleState },
      output: { ...agentOutput },
      writesTo: writesToKeys,
    });
    
    // Write outputs to shared state
    if (agent.writesTo && agent.writesTo.length > 0) {
      agent.writesTo.forEach(key => {
        if (agentOutput[key] !== undefined) {
          sharedState[key] = agentOutput[key];
        }
      });
    } else if (agent.outputTo && agent.outputTo.length > 0) {
      // Legacy support: store output by agent ID
      sharedState[agent.id] = agentOutput;
    } else {
      // Default: store output by agent ID
      sharedState[agent.id] = agentOutput;
    }
  }

  // Find final assembler agent (usually the last one or one with writesTo: ["scenePlan"])
  const finalAssembler = sortedAgents.find(a => 
    a.writesTo?.includes('scenePlan') || 
    a.role === 'final_assembler' ||
    a.name.toLowerCase().includes('director') ||
    a.name.toLowerCase().includes('assembler')
  ) || sortedAgents[sortedAgents.length - 1];

  if (!finalAssembler) {
    throw new Error('No final assembler agent found in workflow');
  }

  // Generate final scene plan
  const scenePlan = await generateFinalScenePlan(
    finalAssembler,
    sharedState,
    sceneCount,
    shotLibrary,
    limits,
    cameraPresets,
    constraints,
    isImageFirst
  );

  // Attach agent contributions to each scene
  const scenesWithContributions = scenePlan.scenes.map((scene: any) => ({
    ...scene,
    agentContributions: agentContributions.map(contrib => ({
      agentId: contrib.agentId,
      agentName: contrib.agentName,
      agentRole: contrib.agentRole,
      order: contrib.order,
      contribution: contrib.output,
      writesTo: contrib.writesTo,
    })),
    finalAssembler: {
      agentId: finalAssembler.id,
      agentName: finalAssembler.name,
      agentRole: finalAssembler.role,
      sharedStateUsed: sharedState,
    },
  }));

  // Validate and return
  const result = {
    scenes: scenesWithContributions,
    renderingSpec: scenePlan.renderingSpec,
  };

  // Validate with retry if video language detected
  // Note: We validate the structure but preserve agent contributions
  let validated;
  try {
    // First validate the basic structure
    const basicValidation = GeneratedProjectSchema.parse({
      scenes: scenesWithContributions.map(({ agentContributions, finalAssembler, ...scene }) => scene),
      renderingSpec: scenePlan.renderingSpec,
    });
    
    // Then merge back the agent contributions (they're optional in schema)
    validated = {
      scenes: basicValidation.scenes.map((scene: any, idx: number) => ({
        ...scene,
        agentContributions: scenesWithContributions[idx].agentContributions,
        finalAssembler: scenesWithContributions[idx].finalAssembler,
      })),
      renderingSpec: basicValidation.renderingSpec,
    };
    
    // Additional validation: check for video language
    const hasVideoLanguage = result.scenes.some(scene => 
      containsVideoLanguage(scene.imagePrompt || '') ||
      containsVideoLanguage(scene.negativePrompt || '') ||
      containsVideoLanguage(scene.notes || '')
    );

    if (hasVideoLanguage && isImageFirst) {
      console.warn('Video language detected, retrying generation...');
      // Retry once
      const retryPlan = await generateFinalScenePlan(
        finalAssembler,
        sharedState,
        sceneCount,
        shotLibrary,
        limits,
        cameraPresets,
        [...constraints, 'CRITICAL: Remove all video language. This is for static image generation only.'],
        isImageFirst
      );
      
      // Re-attach agent contributions to retry scenes
      const retryScenesWithContributions = retryPlan.scenes.map((scene: any) => ({
        ...scene,
        agentContributions: agentContributions.map(contrib => ({
          agentId: contrib.agentId,
          agentName: contrib.agentName,
          agentRole: contrib.agentRole,
          order: contrib.order,
          contribution: contrib.output,
          writesTo: contrib.writesTo,
        })),
        finalAssembler: {
          agentId: finalAssembler.id,
          agentName: finalAssembler.name,
          agentRole: finalAssembler.role,
          sharedStateUsed: sharedState,
        },
      }));
      
      const retryBasicValidation = GeneratedProjectSchema.parse({
        scenes: retryScenesWithContributions.map(({ agentContributions, finalAssembler, ...scene }) => scene),
        renderingSpec: retryPlan.renderingSpec,
      });
      
      validated = {
        scenes: retryBasicValidation.scenes.map((scene: any, idx: number) => ({
          ...scene,
          agentContributions: retryScenesWithContributions[idx].agentContributions,
          finalAssembler: retryScenesWithContributions[idx].finalAssembler,
        })),
        renderingSpec: retryBasicValidation.renderingSpec,
      };
    }
  } catch (error) {
    console.error('Validation error:', error);
    throw error;
  }

  return validated;
}

async function executeAgentWithSharedState(
  agent: AgentDefinition,
  visibleState: Record<string, any>,
  limits: any,
  cameraPresets: string[],
  shotLibrary?: any[]
): Promise<Record<string, any>> {
  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: agent.temperature ?? 0.7,
    openAIApiKey: getApiKey(),
  });

  // Build prompt
  const systemPrompt = agent.systemPrompt || agent.prompt || `You are ${agent.name}, a ${agent.role} in a multi-department ad production pipeline. You ONLY output valid JSON. No prose, no code fences, no markdown.`;
  
  const readsFromKeys = agent.readsFrom || agent.inputFrom || ['input'];
  const writesToKeys = agent.writesTo || [agent.id];
  
  // Build a more helpful prompt that guides the agent
  const hasInput = visibleState.input !== undefined;
  const hasOtherAgents = Object.keys(visibleState).some(k => k !== 'input' && k.startsWith('agent_'));
  
  let taskDescription = agent.prompt || 'Analyze the shared state and produce your output.';
  
  // Enhance task description based on what's available
  if (hasInput && !hasOtherAgents) {
    taskDescription = `Analyze the product information in the "input" object. Based on your role as ${agent.role}, provide insights, recommendations, or analysis that will help create engaging video content. Be specific and actionable.`;
  } else if (hasInput && hasOtherAgents) {
    taskDescription = `Review the product information in "input" and any previous agent contributions. As ${agent.role}, synthesize this information and add your expert perspective to improve the video content strategy.`;
  }
  
  // Build scene-specific guidance
  const sceneTypes = shotLibrary?.map((s: any) => ({ type: s.type, goal: s.goal || s.purpose })) || [];
  const sceneSpecificGuidance = sceneTypes.length > 0 ? `
  
SCENE-SPECIFIC RECOMMENDATIONS REQUIRED:
You MUST provide recommendations for EACH scene type. The video will have these scenes:
${sceneTypes.map((s: any, idx: number) => `${idx + 1}. ${s.type.toUpperCase()}: ${s.goal}`).join('\n')}

CRITICAL: Provide scene-specific recommendations for EACH scene type above. Structure your output to include recommendations for:
${sceneTypes.map((s: any) => `- ${s.type}Scene: specific recommendations for this scene type`).join('\n')}

For example, if you're a fashion expert, provide:
- hookScene: { styleInsights, colorRecommendations, visualDirection for hook scene }
- problemScene: { styleInsights, colorRecommendations, visualDirection for problem scene }
- solutionScene: { styleInsights, colorRecommendations, visualDirection for solution scene }
- proofScene: { styleInsights, colorRecommendations, visualDirection for proof scene }
- ctaScene: { styleInsights, colorRecommendations, visualDirection for cta scene }

If you're a video director, provide:
- hookScene: { cameraAngle, composition, visualStyle for hook scene }
- problemScene: { cameraAngle, composition, visualStyle for problem scene }
- etc.

Each scene type has a different goal and purpose - tailor your recommendations accordingly.` : '';

  const userPrompt = `Shared state (JSON):
${JSON.stringify(visibleState, null, 2)}

Your task as ${agent.name} (${agent.role}):
${taskDescription}

IMPORTANT:
- The "input" object contains product details: productName, offer, features, targetAudience, platform, etc.
- Analyze this information thoroughly based on your role
- Provide specific, actionable insights relevant to your expertise
- If you see previous agent outputs, build upon them
${sceneSpecificGuidance}

Output JSON with exactly these top-level keys:
${JSON.stringify(writesToKeys)}

Each key should contain structured data relevant to your role. ${sceneTypes.length > 0 ? 'MUST include scene-specific recommendations for each scene type listed above.' : 'For example:'}
${sceneTypes.length === 0 ? `- If you're a fashion expert: provide style insights, color recommendations, target audience analysis
- If you're a copywriter: provide messaging ideas, taglines, key phrases
- If you're a visual stylist: provide visual direction, composition ideas, mood suggestions` : ''}

Constraints:
- All strings must be concise and specific
- No markdown, no headings, no bullet points
- Output ONLY valid JSON
- Provide actual analysis, not "No data to analyze"
- ${sceneTypes.length > 0 ? 'MUST provide scene-specific recommendations for each scene type - do not provide generic recommendations for all scenes' : ''}`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await llm.invoke(fullPrompt);
  let content = typeof response.content === 'string' ? response.content : String(response.content);

  // Clean JSON from markdown code fences
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  }
  content = content.trim();

  try {
    const parsed = JSON.parse(content);
    
    // Validate that parsed output has the expected structure
    // If agent just returned a string saying "No data", try to guide them
    const firstKey = writesToKeys[0];
    if (parsed[firstKey] && typeof parsed[firstKey] === 'string') {
      const value = parsed[firstKey].toLowerCase();
      if (value.includes('no data') || value.includes('empty') || value.includes('no context')) {
        console.warn(`Agent ${agent.name} returned unhelpful output. Prompt may need improvement.`);
        // Still return it, but log a warning
      }
    }
    
    // Ensure all expected keys exist
    const result: Record<string, any> = {};
    writesToKeys.forEach(key => {
      result[key] = parsed[key] !== undefined ? parsed[key] : (parsed[firstKey] || 'Analysis pending');
    });
    
    return result;
  } catch (e) {
    // If parsing fails, try to extract JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const result: Record<string, any> = {};
        writesToKeys.forEach(key => {
          result[key] = parsed[key] !== undefined ? parsed[key] : parsed[writesToKeys[0]] || content;
        });
        return result;
      } catch {
        // Fallback: return as structured object with the content
        const result: Record<string, any> = {};
        writesToKeys.forEach(key => {
          result[key] = content;
        });
        return result;
      }
    }
    // Last resort fallback
    const result: Record<string, any> = {};
    writesToKeys.forEach(key => {
      result[key] = content;
    });
    return result;
  }
}

async function generateFinalScenePlan(
  agent: AgentDefinition,
  sharedState: Record<string, any>,
  sceneCount: number,
  shotLibrary: any[],
  limits: any,
  cameraPresets: string[],
  constraints: string[],
  isImageFirst: boolean
): Promise<{ scenes: any[]; renderingSpec: any }> {
  const llm = new ChatOpenAI({
    modelName: getModel(),
    temperature: agent.temperature ?? 0.5,
    openAIApiKey: getApiKey(),
  });

  const input = sharedState.input;
  const templateOutput = input.templateOutput;

  const systemPrompt = `You are the Creative Director (Final Assembler) in a multi-department ad pipeline.
Your CRITICAL role is to CONCATENATE and COMBINE all expert insights from previous agents into comprehensive, detailed scene prompts.

IMPORTANT:
- You MUST incorporate ALL specific details, recommendations, and insights from ALL previous agents
- DO NOT summarize or condense - CONCATENATE all relevant details together
- Each imagePrompt should be COMPREHENSIVE and DETAILED, including:
  * ALL product features mentioned by agents (e.g., handcrafted mirror work, golden threads, peacock border, silk texture)
  * ALL visual elements suggested (colors, lighting, mood, composition, camera angles)
  * ALL stylistic recommendations (accessories, settings, atmosphere)
  * ALL target audience considerations
- Combine details from multiple agents in logical order (visual description → details → mood → composition)
- If multiple agents mention similar things, include ALL variations and details - don't summarize
- Create LONG, RICH prompts that paint a complete picture
- Stay within character limits but use the FULL limit to include maximum detail

You ONLY output valid JSON. No prose, no comments, no code fences, no markdown.

You MUST produce:
{
  "scenePlan": {
    "renderingSpec": {
      "aspectRatio": string,
      "style": string,
      "imageModelHint": string,
      "colorGrade": string,
      "lightingMood": string
    },
    "scenes": [
      {
        "index": number,
        "shotType": string,
        "camera": string,
        "imagePrompt": string (rich, detailed, incorporating agent insights),
        "negativePrompt": string,
        "onScreenText": string,
        "notes": string
      }
    ]
  }
}`;

  // Extract agent contributions for better synthesis
  // Get agent metadata from sharedState
  const agentContributions: Array<{ agentId: string; role: string; name: string; data: any }> = [];
  const agentMetadata = sharedState._agentMetadata || [];
  const sortedAgents = [...agentMetadata].sort((a: any, b: any) => a.order - b.order);
  
  Object.keys(sharedState).forEach(key => {
    if (key.startsWith('agent_') && sharedState[key]) {
      const agentData = sharedState[key];
      // Handle nested structure (agent output stored under agent ID key)
      const actualData = agentData[key] || agentData;
      if (actualData && typeof actualData === 'object' && Object.keys(actualData).length > 0) {
        // Find agent metadata
        const agentMeta = sortedAgents.find((a: any) => a.id === key);
        agentContributions.push({
          agentId: key,
          role: agentMeta?.role || 'unknown',
          name: agentMeta?.name || key,
          data: actualData,
        });
      }
    }
  });
  
  // Sort by order if we have agent metadata
  agentContributions.sort((a, b) => {
    const aOrder = sortedAgents.find((ag: any) => ag.id === a.agentId)?.order || 999;
    const bOrder = sortedAgents.find((ag: any) => ag.id === b.agentId)?.order || 999;
    return aOrder - bOrder;
  });

  const userPrompt = `CRITICAL REQUIREMENTS - ALL SCENES MUST HAVE THESE FIELDS:
- Number of scenes MUST equal ${sceneCount}.
- EVERY scene MUST have a "shotType" field (string). Scene 1 shotType MUST be "hook". Scenes 2-${sceneCount} choose shotType from shotLibrary: ${JSON.stringify(shotLibrary.map(s => s.type))}.
- EVERY scene MUST have an "imagePrompt" field (string, non-empty). 
  **CRITICAL: AIM FOR ${limits.imagePromptMaxChars} CHARACTERS - USE THE FULL LIMIT!** 
  Each scene.imagePrompt MUST be comprehensive and detailed, aiming for ${limits.imagePromptMaxChars} characters (maximum allowed) and up to ${limits.maxSentencesImagePrompt} sentences. 
  DO NOT create short prompts - use EVERY available character to include ALL details from agents.
- EVERY scene MUST have a "camera" field (string). Each scene.camera MUST be one of: ${JSON.stringify(cameraPresets)}.
- Each scene.negativePrompt MUST be <= ${limits.negativesMaxChars} characters (optional but recommended).
- Each scene.onScreenText MUST be <= ${limits.maxWordsOnScreenText} words (optional).
- aspectRatio MUST be "${templateOutput.aspectRatio}".
- style MUST be "${templateOutput.style}".
${isImageFirst ? '- Output is IMAGE prompts for FIRST FRAME only. NO motion, editing, transitions, or video language.' : ''}
${constraints.map(c => `- ${c}`).join('\n')}

CRITICAL: You are the FINAL ASSEMBLER. Your job is to SYNTHESIZE and INCORPORATE all insights from previous agents into rich, detailed scene prompts.

Product Information (from input):
- Product: ${input.productName}
- Offer: ${input.offer}
- Features: ${input.features?.join(', ') || 'Not specified'}
- Target Audience: ${input.targetAudience || 'General audience'}
- Platform: ${input.platform}

Agent Contributions Summary (in execution order):
${agentContributions.length > 0 ? agentContributions.map((contrib, idx) => {
  const contribStr = JSON.stringify(contrib.data, null, 2);
  return `Agent ${idx + 1}: ${contrib.name} (${contrib.role})\nKey Insights:\n${contribStr}`;
}).join('\n\n') : 'No agent contributions found.'}

CONCATENATION INSTRUCTIONS (DO NOT SUMMARIZE):
For EACH scene, you MUST:
1. Review ALL agent contributions above
2. Extract scene-specific recommendations for that scene type:
   - Look for scene-specific keys in agent outputs (e.g., "hookScene", "problemScene", "solutionScene", "proofScene", "ctaScene")
   - If an agent provided scene-specific recommendations (like "hookScene: {...}"), use THOSE for that scene
   - If an agent only provided generic recommendations, extract what's relevant to this scene type
3. CONCATENATE (not summarize) scene-specific insights from ALL agents into ONE comprehensive imagePrompt
4. Build the prompt in this logical order:
   a. Main visual subject and action (what's happening - use scene-specific recommendations)
   b. Product details (ALL features: handcrafted mirror work, golden threads, peacock border, silk texture, etc.)
   c. Visual elements (colors, patterns, textures - from scene-specific recommendations)
   d. Lighting and atmosphere (warm lighting, natural light, mood - from scene-specific recommendations)
   e. Composition and framing (close-up details, medium shots, angles - from scene-specific recommendations)
   f. Setting and context (traditional setting, lifestyle, cultural elements - from scene-specific recommendations)
   g. Emotional elements (expressions, energy, connection - from scene-specific recommendations)
5. PRIORITIZE scene-specific recommendations over generic ones
6. Include EVERY relevant detail from scene-specific agent recommendations
7. If agents mention similar things with different wording, include ALL variations
8. Create LONG, COMPREHENSIVE prompts - use the FULL character limit
9. Example structure: "[Main action/subject from scene-specific recs]. [Product feature 1]. [Product feature 2]. [Visual detail 1 from scene-specific recs]. [Visual detail 2]. [Lighting from scene-specific recs]. [Mood from scene-specific recs]. [Composition from scene-specific recs]. [Setting from scene-specific recs]. [Emotional element from scene-specific recs]."

Full Shared State (for reference):
${JSON.stringify(sharedState, null, 2)}

Your task as Final Assembler:
1. For EACH scene, extract scene-specific recommendations from agents:
   - Look for keys like "hookScene", "problemScene", "solutionScene", "proofScene", "ctaScene" in agent outputs
   - Use scene-specific recommendations when available (e.g., if agent has "proofScene: { cameraAngle: 'Product macro', composition: '...' }", use that for proof scene)
   - If scene-specific recommendations don't exist, extract relevant generic recommendations for that scene type
2. BUILD comprehensive prompts by CONCATENATING (not summarizing) scene-specific details into each scene's imagePrompt:
   - For hook scene: Use "hookScene" recommendations from all agents
   - For problem scene: Use "problemScene" recommendations from all agents
   - For solution scene: Use "solutionScene" recommendations from all agents
   - For proof scene: Use "proofScene" recommendations from all agents
   - For cta scene: Use "ctaScene" recommendations from all agents
   - Include ALL specific product details mentioned by agents
   - Include ALL color recommendations from scene-specific recommendations
   - Include ALL visual direction from scene-specific recommendations (camera angles, composition, lighting)
   - Include ALL mood suggestions from scene-specific recommendations
   - Include ALL setting and context details from scene-specific recommendations
   - Include ALL emotional elements from scene-specific recommendations
3. DO NOT summarize - if multiple agents mention similar things, include ALL variations and details
4. Build prompts in logical order: subject → product details → visual elements → lighting → composition → setting → emotion
5. Use the FULL character limit - create LONG, COMPREHENSIVE prompts with maximum detail
6. Make prompts SPECIFIC and DETAILED - include EVERY product feature, visual element, mood, lighting, composition detail from scene-specific recommendations

Example of good CONCATENATION with scene-specific recommendations:
- For proof scene: If Video Director's "proofScene" says "Product macro" camera and "focus on fabric texture", and Visual Stylist's "proofScene" says "macro shots of fabric texture and movement", CONCATENATE into: "Product macro shot focusing on the luxurious texture of the Red Kurtaset's cotton fabric, highlighting the intricate stitching and modern cut that enhances its stylish appeal, with macro details revealing the fabric's movement and flow that conveys elegance and quality craftsmanship"

For each scene (REQUIRED FIELDS - ALL must be present):
- shotType: REQUIRED string. Scene 1 MUST be "hook", others from shotLibrary: ${JSON.stringify(shotLibrary.map(s => s.type))}
- imagePrompt: REQUIRED string. **AIM FOR ${limits.imagePromptMaxChars} CHARACTERS - USE THE FULL LIMIT!** 
  LONG, COMPREHENSIVE description CONCATENATING ALL relevant agent insights. Include:
  * ALL product features mentioned (handcrafted mirror work, golden threads, peacock border, silk texture, etc.)
  * ALL visual elements (colors, patterns, textures, details)
  * ALL lighting and atmosphere suggestions (warm lighting, natural light, mood)
  * ALL composition ideas (close-ups, medium shots, angles, framing)
  * ALL setting and context (traditional setting, lifestyle, cultural elements)
  * ALL emotional elements (expressions, energy, connection)
  * Build in logical order: subject → product details → visual elements → lighting → composition → setting → emotion
  * **CRITICAL: Use EVERY available character up to ${limits.imagePromptMaxChars} - create the LONGEST, MOST COMPREHENSIVE prompts possible**
- camera: REQUIRED string. Must be one of: ${JSON.stringify(cameraPresets)}
- negativePrompt: Optional string. What to avoid (based on constraints and agent suggestions)
- onScreenText: Optional string. Brief, impactful text (consider agent messaging suggestions)
- notes: Optional string. Any production notes from agent recommendations

Design the final ${isImageFirst ? 'image-first frame' : 'video'} plan, then output EXACTLY this JSON structure:
{
  "scenePlan": {
    "renderingSpec": { ... },
    "scenes": [
      {
        "index": 1,
        "shotType": "hook",
        "camera": "CU handheld face",
        "imagePrompt": "Detailed prompt here...",
        "negativePrompt": "...",
        "onScreenText": "...",
        "notes": "..."
      },
      ...
    ]
  }
}`;

  const response = await llm.invoke(`${systemPrompt}\n\n${userPrompt}`);
  let content = typeof response.content === 'string' ? response.content : String(response.content);

  // Clean JSON
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  }
  content = content.trim();

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse final agent output as JSON');
    }
  }

  const scenePlan = parsed.scenePlan || parsed;
  
  // Validate scene count
  if (!scenePlan.scenes || scenePlan.scenes.length !== sceneCount) {
    throw new Error(`Expected ${sceneCount} scenes, got ${scenePlan.scenes?.length || 0}`);
  }

  // Validate and fix scenes - ensure required fields exist BEFORE validation
  scenePlan.scenes.forEach((scene: any, idx: number) => {
    // Ensure index is correct
    scene.index = idx + 1;
    
    // Ensure shotType exists FIRST (before any other checks)
    if (!scene.shotType) {
      // Use shotLibrary if available
      const availableTypes = shotLibrary.map(s => s.type);
      if (idx === 0) {
        scene.shotType = 'hook';
      } else {
        scene.shotType = availableTypes[idx] || availableTypes[idx % availableTypes.length] || 'general';
      }
    }
    
    // Scene 1 must be hook
    if (idx === 0 && scene.shotType !== 'hook') {
      scene.shotType = 'hook';
    }
    
    // Ensure imagePrompt exists - provide default if missing
    if (!scene.imagePrompt || typeof scene.imagePrompt !== 'string' || scene.imagePrompt.trim().length === 0) {
      // Generate a basic prompt based on shotType
      const shotInfo = shotLibrary.find(s => s.type === scene.shotType) || shotLibrary[idx] || { type: 'general', goal: 'Show product' };
      scene.imagePrompt = `${shotInfo.goal || 'Show product'} scene with clear composition and good lighting`;
    }
    
    // Ensure camera exists
    if (!scene.camera || typeof scene.camera !== 'string') {
      scene.camera = cameraPresets[0] || 'CU handheld face';
    }
    
    // Validate camera is from presets
    if (!cameraPresets.includes(scene.camera)) {
      // Use first preset as fallback
      scene.camera = cameraPresets[0] || 'CU handheld face';
    }
    
    // Enforce imagePrompt limits
    if (scene.imagePrompt) {
      // Check sentence count first
      const sentences = scene.imagePrompt.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
      if (sentences.length > limits.maxSentencesImagePrompt) {
        scene.imagePrompt = sentences.slice(0, limits.maxSentencesImagePrompt).join('. ') + '.';
      }
      
      // Check character limit - truncate at word boundary, not mid-word
      if (scene.imagePrompt.length > limits.imagePromptMaxChars) {
        let truncated = scene.imagePrompt.substring(0, limits.imagePromptMaxChars);
        // Try to find the last complete word before the limit
        const lastSpace = truncated.lastIndexOf(' ');
        const lastPeriod = truncated.lastIndexOf('.');
        const lastExclamation = truncated.lastIndexOf('!');
        const lastQuestion = truncated.lastIndexOf('?');
        const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
        
        // If we're close to a sentence end, cut there
        if (lastSentenceEnd > limits.imagePromptMaxChars - 20) {
          truncated = truncated.substring(0, lastSentenceEnd + 1);
        } else if (lastSpace > limits.imagePromptMaxChars - 10) {
          // Otherwise cut at the last word boundary
          truncated = truncated.substring(0, lastSpace);
        }
        scene.imagePrompt = truncated;
      }
    }
    // Note: imagePrompt is already ensured to exist above, so this else block is no longer needed
    
    // Enforce negativePrompt limits
    if (scene.negativePrompt) {
      if (scene.negativePrompt.length > limits.negativesMaxChars) {
        scene.negativePrompt = scene.negativePrompt.substring(0, limits.negativesMaxChars);
      }
    }
    
    // Enforce onScreenText word limit
    if (scene.onScreenText) {
      const words = scene.onScreenText.split(/\s+/).filter((w: string) => w.length > 0);
      if (words.length > limits.maxWordsOnScreenText) {
        scene.onScreenText = words.slice(0, limits.maxWordsOnScreenText).join(' ');
      }
    }
    
    // Remove video language if detected
    if (containsVideoLanguage(scene.imagePrompt)) {
      // Try to clean it
      scene.imagePrompt = scene.imagePrompt
        .replace(/pan|zoom|transition|montage|cut|voiceover|music|beat/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  });
  
  // Validate indices are unique and sequential
  const indices = scenePlan.scenes.map((s: any) => s.index).sort((a: number, b: number) => a - b);
  if (!indices.every((idx: number, i: number) => idx === i + 1)) {
    throw new Error('Scene indices must be unique and sequential starting from 1');
  }

  return {
    scenes: scenePlan.scenes,
    renderingSpec: scenePlan.renderingSpec || {
      aspectRatio: templateOutput.aspectRatio,
      style: templateOutput.style,
      imageModelHint: 'photorealistic',
      colorGrade: 'natural',
      lightingMood: 'soft daylight',
    },
  };
}
