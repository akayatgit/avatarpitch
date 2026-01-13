'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ContentTypeDefinitionSchema, ContentCreationRequestSchema } from '@/lib/schemas';
import { generateContent } from '@/lib/generation/contentGenerator';
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
    // Ensure content types exist (they should be seeded via SQL, but check anyway)
    const { data: contentTypes, error: contentTypesError } = await supabaseAdmin
      .from('content_types')
      .select('id')
      .limit(1);

    // Check for network errors first
    if (contentTypesError && isSupabaseNetworkError(contentTypesError)) {
      throw new Error('NETWORK_ERROR: No internet connection. Please check your network and try again.');
    }

    if (contentTypesError) {
      throw contentTypesError;
    }

    if (!contentTypes || contentTypes.length === 0) {
      // Return success but with a flag indicating no content types
      // This allows the app to continue functioning, and individual pages can handle the empty state
      return { success: true, hasContentTypes: false };
    }

    return { success: true, hasContentTypes: true };
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
  const category = formData.get('category') as string;
  const version = formData.get('version') as string;
  const outputContractStr = formData.get('outputContract') as string;
  const sceneGenerationPolicyStr = formData.get('sceneGenerationPolicy') as string;
  const inputsContractStr = formData.get('inputsContract') as string;
  const promptingStr = formData.get('prompting') as string;

  if (!name || name.trim().length === 0) {
    return { error: 'Content type name is required' };
  }

  if (!category || !version || !outputContractStr || !sceneGenerationPolicyStr || !inputsContractStr || !promptingStr) {
    return { error: 'All required fields must be provided' };
  }

  let outputContract, sceneGenerationPolicy, inputsContract, prompting;
  try {
    if (!outputContractStr || !sceneGenerationPolicyStr || !inputsContractStr || !promptingStr) {
      return { error: 'All required JSON fields must be provided' };
    }
    outputContract = JSON.parse(outputContractStr);
    sceneGenerationPolicy = JSON.parse(sceneGenerationPolicyStr);
    inputsContract = JSON.parse(inputsContractStr);
    prompting = JSON.parse(promptingStr);
  } catch (e) {
    return { error: `Invalid JSON in one or more fields: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }

  // Build ContentTypeDefinition object
  const contentTypeData = {
    id: randomUUID(), // Generate UUID for validation (database will use its own if needed)
    name: name.trim(),
    category: category as any,
    description: description?.trim() || undefined,
    version: version.trim(),
    outputContract,
    sceneGenerationPolicy,
    inputsContract,
    prompting,
  };

  // Validate with Zod
  const validationResult = ContentTypeDefinitionSchema.safeParse(contentTypeData);
  if (!validationResult.success) {
    return { error: `Validation failed: ${validationResult.error.message}` };
  }

  const coverImageUrl = formData.get('coverImageUrl') as string | null;

  // Check if a content type with this name already exists
  const trimmedName = validationResult.data.name.trim();
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('content_types')
    .select('id, name')
    .eq('name', trimmedName)
    .maybeSingle();

  // If we found an existing content type with this name, return error
  if (existing && !checkError) {
    return { error: `A content type with the name "${trimmedName}" already exists. Please choose a different name.` };
  }

  const { data, error } = await supabaseAdmin
    .from('content_types')
    .insert({
      name: trimmedName,
      category: validationResult.data.category,
      description: validationResult.data.description || null,
      version: validationResult.data.version,
      output_contract: validationResult.data.outputContract,
      scene_generation_policy: validationResult.data.sceneGenerationPolicy,
      inputs_contract: validationResult.data.inputsContract,
      prompting: validationResult.data.prompting,
      cover_image_url: coverImageUrl || null,
    })
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
      return { error: `A content type with the name "${trimmedName}" already exists. Please choose a different name.` };
    }
    return { error: error.message };
  }

  revalidatePath('/app/templates');
  return { success: true, data };
}

export async function updateTemplate(formData: FormData) {
  const templateId = formData.get('templateId') as string;
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const version = formData.get('version') as string;
  const outputContractStr = formData.get('outputContract') as string;
  const sceneGenerationPolicyStr = formData.get('sceneGenerationPolicy') as string;
  const inputsContractStr = formData.get('inputsContract') as string;
  const promptingStr = formData.get('prompting') as string;

  if (!templateId || templateId.trim().length === 0) {
    return { error: 'Content type ID is required' };
  }

  if (!name || name.trim().length === 0) {
    return { error: 'Content type name is required' };
  }

  if (!category || !version || !outputContractStr || !sceneGenerationPolicyStr || !inputsContractStr || !promptingStr) {
    return { error: 'All required fields must be provided' };
  }

  let outputContract, sceneGenerationPolicy, inputsContract, prompting;
  try {
    if (!outputContractStr || !sceneGenerationPolicyStr || !inputsContractStr || !promptingStr) {
      return { error: 'All required JSON fields must be provided' };
    }
    outputContract = JSON.parse(outputContractStr);
    sceneGenerationPolicy = JSON.parse(sceneGenerationPolicyStr);
    inputsContract = JSON.parse(inputsContractStr);
    prompting = JSON.parse(promptingStr);
  } catch (e) {
    return { error: `Invalid JSON in one or more fields: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }

  // Build ContentTypeDefinition object
  const contentTypeData = {
    id: templateId,
    name: name.trim(),
    category: category as any,
    description: description?.trim() || undefined,
    version: version.trim(),
    outputContract,
    sceneGenerationPolicy,
    inputsContract,
    prompting,
  };

  // Validate with Zod
  const validationResult = ContentTypeDefinitionSchema.safeParse(contentTypeData);
  if (!validationResult.success) {
    return { error: `Validation failed: ${validationResult.error.message}` };
  }

  const coverImageUrl = formData.get('coverImageUrl') as string | null;

  // Check if a content type with this name already exists (excluding the current one)
  const trimmedName = validationResult.data.name.trim();
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('content_types')
    .select('id, name')
    .eq('name', trimmedName)
    .neq('id', templateId)
    .maybeSingle();

  // If we found an existing content type with this name, return error
  if (existing && !checkError) {
    return { error: `A content type with the name "${trimmedName}" already exists. Please choose a different name.` };
  }

  const updateData: any = {
      name: trimmedName,
      category: validationResult.data.category,
      description: validationResult.data.description || null,
      version: validationResult.data.version,
      output_contract: validationResult.data.outputContract,
      scene_generation_policy: validationResult.data.sceneGenerationPolicy,
      inputs_contract: validationResult.data.inputsContract,
      prompting: validationResult.data.prompting,
      updated_at: new Date().toISOString(),
  };

  // Only update cover_image_url if provided
  if (coverImageUrl !== null) {
    updateData.cover_image_url = coverImageUrl;
  }

  const { data, error } = await supabaseAdmin
    .from('content_types')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
      return { error: `A content type with the name "${trimmedName}" already exists. Please choose a different name.` };
    }
    return { error: error.message };
  }

  revalidatePath('/app/templates');
  revalidatePath(`/app/templates/${templateId}`);
  revalidatePath('/app/create'); // Revalidate create page to show updated content types
  revalidatePath('/app'); // Revalidate app root to ensure all pages get fresh data
  return { success: true, data };
}

export async function deleteTemplate(formData: FormData) {
  const id = formData.get('id') as string;

  if (!id) {
    return { error: 'Content type ID is required' };
  }

  const { error } = await supabaseAdmin.from('content_types').delete().eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/templates');
  return { success: true };
}

export async function updateTemplateCoverImage(formData: FormData) {
  const id = formData.get('id') as string;
  const coverImageUrl = formData.get('coverImageUrl') as string;

  if (!id) {
    return { error: 'Content type ID is required' };
  }

  if (!coverImageUrl) {
    return { error: 'Cover image URL is required' };
  }

  const { error } = await supabaseAdmin
    .from('content_types')
    .update({
      cover_image_url: coverImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/app/templates');
  return { success: true };
}

// Helper function to build dynamic Zod schema from inputsContract
function buildInputsSchema(inputsContract: { fields: Array<{
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'list';
  required: boolean;
  options?: string[];
  maxLength?: number;
  maxItems?: number;
}> }) {
  const schemaShape: Record<string, any> = {};
  
  for (const field of inputsContract.fields) {
    let fieldSchema: any;
    
    switch (field.type) {
      case 'string':
        // For required fields, ensure non-empty and non-whitespace strings
        if (field.required) {
          fieldSchema = z.string().min(1, 'Required').refine((val) => val.trim().length > 0, {
            message: 'Required'
          });
        } else {
        fieldSchema = z.string();
        }
        if (field.maxLength) {
          fieldSchema = fieldSchema.max(field.maxLength);
        }
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'enum':
        if (field.options && field.options.length > 0) {
          fieldSchema = z.enum(field.options as [string, ...string[]]);
        } else {
          fieldSchema = z.string(); // Fallback if no options
        }
        break;
      case 'list':
        fieldSchema = z.array(z.string());
        if (field.maxItems) {
          fieldSchema = fieldSchema.max(field.maxItems);
        }
        break;
      default:
        fieldSchema = z.any();
    }
    
    // Handle nested keys (dot notation)
    const keys = field.key.split('.');
    let current = schemaShape;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const lastKey = keys[keys.length - 1];
    if (field.required) {
      current[lastKey] = fieldSchema;
    } else {
      current[lastKey] = fieldSchema.optional();
    }
  }
  
  // Build nested object schema recursively
  function buildNestedSchema(obj: Record<string, any>): z.ZodRawShape {
    const shape: z.ZodRawShape = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object' && !('_def' in value)) {
        // It's a nested object - recursively build its shape
        shape[key] = z.object(buildNestedSchema(value));
      } else {
        // It's a Zod schema
        shape[key] = value;
      }
    }
    return shape;
  }
  
  return z.object(buildNestedSchema(schemaShape));
}

export async function generateProject(formData: FormData) {
  const contentTypeId = formData.get('contentTypeId') as string;
  const inputsStr = formData.get('inputs') as string;

  if (!contentTypeId) {
    return { error: 'Content type ID is required' };
  }

  if (!inputsStr) {
    return { error: 'Inputs are required' };
  }

  // Get current user
  const { getCurrentUser } = await import('@/lib/session');
  const user = await getCurrentUser();
  
  if (!user?.id) {
    return { error: 'You must be logged in to create a project' };
  }

  let inputs;
  try {
    if (!inputsStr) {
      return { error: 'Inputs field is required' };
    }
    inputs = JSON.parse(inputsStr);
  } catch (e) {
    return { error: `Invalid JSON in inputs field: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }

  // Fetch content type FIRST to build dynamic schema
  const { data: contentTypeData, error: contentTypeError } = await supabaseAdmin
    .from('content_types')
    .select('*')
    .eq('id', contentTypeId)
    .single();

  if (contentTypeError || !contentTypeData) {
    return { error: 'Content type not found' };
  }

  // Handle potential JSON string parsing
  let inputsContract = contentTypeData.inputs_contract;
  if (typeof inputsContract === 'string') {
    try {
      inputsContract = JSON.parse(inputsContract);
    } catch (e) {
      return { error: 'Invalid inputs contract in content type' };
    }
  }

  // Build dynamic schema from inputsContract
  if (inputsContract?.fields && inputsContract.fields.length > 0) {
    try {
      const dynamicInputsSchema = buildInputsSchema(inputsContract);
      const validationResult = dynamicInputsSchema.safeParse(inputs);
      if (!validationResult.success) {
        
        // Create a map of field keys to labels for better error messages
        const fieldKeyToLabel = new Map<string, string>();
        inputsContract.fields.forEach((field: any) => {
          fieldKeyToLabel.set(field.key, field.label);
        });
        
        // Format error messages with field labels
        const errorMessages = validationResult.error.errors.map(e => {
          const fieldPath = e.path.join('.');
          // Try to find matching field by key (exact match or partial match)
          let fieldLabel = fieldKeyToLabel.get(fieldPath);
          if (!fieldLabel) {
            // Try to find by matching the last part of the path
            const lastKey = e.path[e.path.length - 1];
            for (const [key, label] of fieldKeyToLabel.entries()) {
              if (key.split('.').pop() === lastKey || key === lastKey) {
                fieldLabel = label;
                break;
              }
            }
          }
          return `${fieldLabel || fieldPath}: ${e.message}`;
        });
        
        return { error: `Validation failed: ${errorMessages.join(', ')}` };
      }
    } catch (schemaError) {
      console.error('Error building dynamic schema:', schemaError);
      // Continue without validation if schema building fails
    }
  }

  // Convert database structure to ContentTypeDefinition format
  const contentType = {
    id: contentTypeData.id,
    name: contentTypeData.name,
    category: contentTypeData.category,
    description: contentTypeData.description,
    version: contentTypeData.version,
    outputContract: contentTypeData.output_contract,
    sceneGenerationPolicy: contentTypeData.scene_generation_policy,
    inputsContract: inputsContract,
    prompting: contentTypeData.prompting,
  };

  try {
    // Mock video URL
    const videoUrl = 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4';

    // Save to database immediately with 'pending' status
    // This allows the user to close the app and come back later
    // Status will be updated to 'processing' then 'completed' by background process
    const { data: savedRequest, error: saveError } = await supabaseAdmin
      .from('content_creation_requests')
      .insert({
        content_type_id: contentTypeId,
        inputs: inputs,
        generated_output: null, // Will be updated when generation completes
        status: 'pending', // Use 'pending' as initial status (will be updated to 'processing' by background API)
        video_url: videoUrl,
        user_id: user.id,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving project to database:', saveError);
      // Log detailed error information
      console.error('Save error details:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
      });
      // Return error if save fails - we need the projectId for image generation
      return {
        error: `Failed to save project: ${saveError.message || 'Database error'}`,
      };
    }

    if (!savedRequest?.id) {
      console.error('Project saved but no ID returned:', savedRequest);
      return {
        error: 'Project saved but failed to retrieve project ID',
      };
    }

    revalidatePath('/app');

    // Return immediately with projectId - generation will happen in background
    return {
      success: true,
      data: {
        format: 'storyboard_v1',
        scenes: [], // Empty initially, will be populated by background process
        textOverlaySuggestions: [],
        thumbnailPrompt: '',
        videoUrl,
        contentTypeName: contentType.name,
        templateName: contentType.name, // For backward compatibility
        requestId: savedRequest.id,
        projectId: savedRequest.id, // Required for image generation
        status: 'processing', // Indicate that generation is in progress
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}

export async function updateProjectImages(projectId: string, generatedImages: Array<{ sceneIndex: number; url: string; imageIndex?: number }>) {
  if (!projectId) {
    return { error: 'Project ID is required' };
  }

  try {
    // Insert images into the generated_images table
    // This avoids race conditions by using individual row inserts instead of JSONB updates
    const imageInserts = generatedImages.map((img) => ({
      content_creation_request_id: projectId,
      scene_index: img.sceneIndex,
      image_url: img.url,
      image_index: img.imageIndex ?? 0,
    }));

    // Use upsert to handle duplicates gracefully (ON CONFLICT DO NOTHING)
    const { error: insertError } = await supabaseAdmin
      .from('generated_images')
      .upsert(imageInserts, {
        onConflict: 'content_creation_request_id,scene_index,image_index',
        ignoreDuplicates: true,
      });

    if (insertError) {
      return { error: insertError.message };
    }

    revalidatePath('/app');
    revalidatePath(`/app/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update project images',
    };
  }
}

