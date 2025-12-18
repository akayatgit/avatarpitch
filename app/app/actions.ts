'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TemplateConfigSchema, CreateProjectFormSchema } from '@/lib/schemas';
import { generateScenes } from '@/lib/sceneAgent';
import { isSupabaseNetworkError } from '@/lib/networkError';

// Agent CRUD operations
export async function createAgent(formData: FormData) {
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const systemPrompt = formData.get('systemPrompt') as string;
  const prompt = formData.get('prompt') as string;
  const temperatureStr = formData.get('temperature') as string;

  if (!name || name.trim().length === 0) {
    return { error: 'Agent name is required' };
  }

  if (!role || role.trim().length === 0) {
    return { error: 'Agent role is required' };
  }

  const temperature = temperatureStr ? parseFloat(temperatureStr) : 0.7;
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    return { error: 'Temperature must be between 0 and 2' };
  }

  const { data, error } = await supabaseAdmin
    .from('agents')
    .insert({
      name: name.trim(),
      role: role.trim(),
      system_prompt: systemPrompt?.trim() || null,
      prompt: prompt?.trim() || null,
      temperature,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/agents');
  return { success: true, data };
}

export async function updateAgent(formData: FormData) {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const systemPrompt = formData.get('systemPrompt') as string;
  const prompt = formData.get('prompt') as string;
  const temperatureStr = formData.get('temperature') as string;

  if (!id) {
    return { error: 'Agent ID is required' };
  }

  if (!name || name.trim().length === 0) {
    return { error: 'Agent name is required' };
  }

  if (!role || role.trim().length === 0) {
    return { error: 'Agent role is required' };
  }

  const temperature = temperatureStr ? parseFloat(temperatureStr) : 0.7;
  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    return { error: 'Temperature must be between 0 and 2' };
  }

  const { data, error } = await supabaseAdmin
    .from('agents')
    .update({
      name: name.trim(),
      role: role.trim(),
      system_prompt: systemPrompt?.trim() || null,
      prompt: prompt?.trim() || null,
      temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/agents');
  return { success: true, data };
}

export async function deleteAgent(formData: FormData) {
  const id = formData.get('id') as string;

  if (!id) {
    return { error: 'Agent ID is required' };
  }

  const { error } = await supabaseAdmin.from('agents').delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/agents');
  return { success: true };
}

export async function bootstrap() {
  try {
    // Ensure templates exist (they should be seeded via SQL, but check anyway)
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('templates')
      .select('id')
      .limit(1);

    // Check for network errors first
    if (templatesError && isSupabaseNetworkError(templatesError)) {
      throw new Error('NETWORK_ERROR: No internet connection. Please check your network and try again.');
    }

    if (templatesError) {
      throw templatesError;
    }

    if (!templates || templates.length === 0) {
      // Return success but with a flag indicating no templates
      // This allows the app to continue functioning, and individual pages can handle the empty state
      return { success: true, hasTemplates: false };
    }

    return { success: true, hasTemplates: true };
  } catch (error: any) {
    // Re-throw network errors with the special prefix
    if (error.message?.startsWith('NETWORK_ERROR:')) {
      throw error;
    }
    
    // Check if it's a network error
    if (isSupabaseNetworkError(error)) {
      throw new Error('NETWORK_ERROR: No internet connection. Please check your network and try again.');
    }
    
    // Re-throw other errors as-is
    throw error;
  }
}


export async function createTemplate(formData: FormData) {
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const configStr = formData.get('config') as string;

  if (!name || name.trim().length === 0) {
    return { error: 'Template name is required' };
  }

  if (!configStr || configStr.trim().length === 0) {
    return { error: 'Template config is required' };
  }

  let config;
  try {
    config = JSON.parse(configStr);
  } catch (e) {
    return { error: 'Invalid JSON in config field' };
  }

  // Validate with Zod
  const validationResult = TemplateConfigSchema.safeParse(config);
  if (!validationResult.success) {
    return { error: `Config validation failed: ${validationResult.error.message}` };
  }

  const { data, error } = await supabaseAdmin
    .from('templates')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      config: validationResult.data,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/templates');
  return { success: true, data };
}

export async function updateTemplate(formData: FormData) {
  const templateId = formData.get('templateId') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const configStr = formData.get('config') as string;

  if (!templateId || templateId.trim().length === 0) {
    return { error: 'Template ID is required' };
  }

  if (!name || name.trim().length === 0) {
    return { error: 'Template name is required' };
  }

  if (!configStr || configStr.trim().length === 0) {
    return { error: 'Template config is required' };
  }

  let config;
  try {
    config = JSON.parse(configStr);
  } catch (e) {
    return { error: 'Invalid JSON in config field' };
  }

  // Validate with Zod
  const validationResult = TemplateConfigSchema.safeParse(config);
  if (!validationResult.success) {
    return { error: `Config validation failed: ${validationResult.error.message}` };
  }

  const { data, error } = await supabaseAdmin
    .from('templates')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      config: validationResult.data,
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/templates');
  revalidatePath(`/app/templates/${templateId}`);
  return { success: true, data };
}

export async function generateProject(formData: FormData) {
  // Parse and validate form data
  const rawData = {
    templateId: formData.get('templateId') as string,
    productName: formData.get('productName') as string,
    productLink: formData.get('productLink') as string,
    offer: formData.get('offer') as string,
    features: formData.get('features') as string,
    targetAudience: formData.get('targetAudience') as string,
    platform: formData.get('platform') as 'TikTok' | 'Reels' | 'Shorts',
  };

  // Parse features array (comma-separated)
  const featuresArray = rawData.features
    ? rawData.features
        .split(',')
        .map((f: string) => f.trim())
        .filter((f: string) => f.length > 0)
        .slice(0, 5)
    : undefined;

  const formDataParsed = {
    ...rawData,
    productLink: rawData.productLink || undefined,
    offer: rawData.offer || undefined,
    features: featuresArray,
    targetAudience: rawData.targetAudience || undefined,
    platform: rawData.platform || undefined,
  };

  const validationResult = CreateProjectFormSchema.safeParse(formDataParsed);
  if (!validationResult.success) {
    return { error: `Validation failed: ${validationResult.error.message}` };
  }

  // Fetch template directly
  const { data: template, error: templateError } = await supabaseAdmin
    .from('templates')
    .select('id, name, config')
    .eq('id', validationResult.data.templateId)
    .single();

  if (templateError || !template) {
    return { error: 'Template not found' };
  }

  // Validate template config
  const configValidation = TemplateConfigSchema.safeParse(template.config);
  if (!configValidation.success) {
    return { error: 'Invalid template config' };
  }

  // Generate scenes
  try {
    const generated = await generateScenes({
      templateConfig: configValidation.data,
      productName: validationResult.data.productName,
      productLink: validationResult.data.productLink,
      offer: validationResult.data.offer || undefined,
      features: validationResult.data.features,
      targetAudience: validationResult.data.targetAudience,
      platform: (validationResult.data.platform && validationResult.data.platform !== '') 
        ? validationResult.data.platform as 'TikTok' | 'Reels' | 'Shorts'
        : undefined,
    });

    // Mock video URL (stable sample)
    const videoUrl = 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4';

    // Save project to database
    const projectName = `${validationResult.data.productName} - ${template.name}`;
    const { data: savedProject, error: saveError } = await supabaseAdmin
      .from('projects')
      .insert({
        name: projectName,
        template_id: template.id,
        template_name: template.name,
        product_name: validationResult.data.productName,
        product_link: validationResult.data.productLink || null,
        offer: validationResult.data.offer || '',
        features: validationResult.data.features || null,
        target_audience: validationResult.data.targetAudience || null,
        platform: validationResult.data.platform || '',
        scenes: generated.scenes,
        rendering_spec: generated.renderingSpec,
        video_url: videoUrl,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving project:', saveError);
      // Still return success with the generated data even if save fails
    }

    revalidatePath('/app');

    return {
      success: true,
      data: {
        ...generated,
        videoUrl,
        templateName: template.name,
        projectId: savedProject?.id,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to generate scenes',
    };
  }
}

export async function updateProjectImages(projectId: string, generatedImages: Array<{ sceneIndex: number; url: string }>) {
  if (!projectId) {
    return { error: 'Project ID is required' };
  }

  try {
    // Fetch the current project
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('scenes')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return { error: 'Project not found' };
    }

    // Group images by scene index
    const imagesByScene = new Map<number, string[]>();
    generatedImages.forEach((img) => {
      if (!imagesByScene.has(img.sceneIndex)) {
        imagesByScene.set(img.sceneIndex, []);
      }
      imagesByScene.get(img.sceneIndex)!.push(img.url);
    });

    // Update scenes with image URLs
    const updatedScenes = (project.scenes as any[]).map((scene: any) => {
      const sceneImages = imagesByScene.get(scene.index) || [];
      return {
        ...scene,
        imageUrls: sceneImages.length > 0 ? sceneImages : (scene.imageUrls || []),
      };
    });

    // Update the project
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({
        scenes: updatedScenes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (updateError) {
      return { error: updateError.message };
    }

    revalidatePath('/app');
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update project images',
    };
  }
}

