import { ContentTypeDefinition, ContentCreationRequest } from '../schemas';

/**
 * Helper to get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Extract and validate dynamic inputs based on contentType.inputsContract.fields
 * No fixed schema - everything is dynamic
 */
export function extractDynamicInputs(
  contentType: ContentTypeDefinition,
  inputs: ContentCreationRequest['inputs']
): Record<string, any> {
  const dynamicInputs: Record<string, any> = {};
  
  if (!contentType.inputsContract?.fields || contentType.inputsContract.fields.length === 0) {
    // If no fields defined, return empty object
    return dynamicInputs;
  }

  // Extract values based on field definitions
  for (const field of contentType.inputsContract.fields) {
    const value = getNestedValue(inputs, field.key);
    
    // Validate required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      throw new Error(`Required field "${field.label}" (${field.key}) is missing`);
    }
    
    // Only include fields that have values (omit undefined/null)
    if (value !== undefined && value !== null && value !== '') {
      // Use the field label as the key for better readability in prompts
      // Or use the key itself - let's use label for prompts
      dynamicInputs[field.label] = value;
    }
  }

  return dynamicInputs;
}

