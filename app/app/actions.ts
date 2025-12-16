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
      throw new Error('No templates found. Please run supabase.sql migration first.');
    }

    // Ensure default workspace exists and has a template assigned
    const { data: defaultWorkspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, template_id')
      .eq('name', 'default')
      .single();

    // Check for network errors
    if (workspaceError && isSupabaseNetworkError(workspaceError)) {
      throw new Error('NETWORK_ERROR: No internet connection. Please check your network and try again.');
    }

    if (defaultWorkspace && !defaultWorkspace.template_id) {
      // Assign first template to default workspace
      const { data: firstTemplate, error: templateError } = await supabaseAdmin
        .from('templates')
        .select('id')
        .limit(1)
        .single();

      if (templateError && isSupabaseNetworkError(templateError)) {
        throw new Error('NETWORK_ERROR: No internet connection. Please check your network and try again.');
      }

      if (firstTemplate) {
        const { error: updateError } = await supabaseAdmin
          .from('workspaces')
          .update({ template_id: firstTemplate.id })
          .eq('id', defaultWorkspace.id);

        if (updateError && isSupabaseNetworkError(updateError)) {
          throw new Error('NETWORK_ERROR: No internet connection. Please check your network and try again.');
        }
      }
    }

    return { success: true };
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

export async function createWorkspace(formData: FormData) {
  const name = formData.get('name') as string;

  if (!name || name.trim().length === 0) {
    return { error: 'Workspace name is required' };
  }

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/workspaces');
  return { success: true, data };
}

export async function updateWorkspaceTemplate(workspaceId: string, templateId: string | null) {
  const { error } = await supabaseAdmin
    .from('workspaces')
    .update({ template_id: templateId })
    .eq('id', workspaceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/workspaces');
  revalidatePath('/app');
  return { success: true };
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
    workspaceId: formData.get('workspaceId') as string,
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
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
        .slice(0, 5)
    : undefined;

  const formDataParsed = {
    ...rawData,
    productLink: rawData.productLink || undefined,
    features: featuresArray,
    targetAudience: rawData.targetAudience || undefined,
  };

  const validationResult = CreateProjectFormSchema.safeParse(formDataParsed);
  if (!validationResult.success) {
    return { error: `Validation failed: ${validationResult.error.message}` };
  }

  // Fetch workspace and template
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, template_id')
    .eq('id', validationResult.data.workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return { error: 'Workspace not found' };
  }

  if (!workspace.template_id) {
    return { error: 'Workspace has no template assigned' };
  }

  const { data: template, error: templateError } = await supabaseAdmin
    .from('templates')
    .select('id, name, config')
    .eq('id', workspace.template_id)
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
      offer: validationResult.data.offer,
      features: validationResult.data.features,
      targetAudience: validationResult.data.targetAudience,
      platform: validationResult.data.platform,
    });

    // Mock video URL (stable sample)
    const videoUrl = 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4';

    return {
      success: true,
      data: {
        ...generated,
        videoUrl,
        workspaceName: workspace.name,
        templateName: template.name,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to generate scenes',
    };
  }
}

