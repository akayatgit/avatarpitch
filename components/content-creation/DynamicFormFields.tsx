'use client';

import { useState, useEffect } from 'react';
import { ContentTypeDefinition } from '@/lib/schemas';

interface DynamicFormFieldsProps {
  contentType: ContentTypeDefinition | null;
  formData: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

// Helper function to set nested value using dot notation
function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;
  
  for (const key of keys) {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
  return obj;
}

// Helper function to get nested value using dot notation
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

export default function DynamicFormFields({ contentType, formData, onChange }: DynamicFormFieldsProps) {
  const [localData, setLocalData] = useState<Record<string, any>>(formData);

  useEffect(() => {
    console.log('[DynamicFormFields] Content type updated:', {
      name: contentType?.name,
      fieldsCount: contentType?.inputsContract?.fields?.length
    });
    setLocalData(formData);
  }, [contentType, formData]);

  const handleFieldChange = (key: string, value: any) => {
    const newData = { ...localData };
    // If key contains spaces (not dot notation), use it as a flat key
    // Otherwise, use nested value setting
    if (key.includes(' ') && !key.includes('.')) {
      newData[key] = value;
    } else {
      setNestedValue(newData, key, value);
    }
    setLocalData(newData);
    onChange(newData);
  };

  if (!contentType || !contentType.inputsContract?.fields || contentType.inputsContract.fields.length === 0) {
    console.warn('[DynamicFormFields] No fields found for:', contentType?.name, {
      hasInputsContract: !!contentType?.inputsContract,
      fieldsLength: contentType?.inputsContract?.fields?.length
    });
    return (
      <div className="text-sm text-gray-400 p-4 bg-gray-900 rounded-lg">
        No input fields defined for this content type. Please select a content type first.
      </div>
    );
  }

  console.log('[DynamicFormFields] Rendering', contentType.inputsContract.fields.length, 'fields');

  return (
    <div className="space-y-5">
      {contentType.inputsContract.fields.map((field) => {
        const fieldValue = getNestedValue(localData, field.key);
        const fieldId = `field-${field.key.replace(/\./g, '-')}`;

        return (
          <div key={field.key}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-white mb-2">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
              {field.helpText && (
                <span className="text-xs text-gray-400 font-normal ml-2">({field.helpText})</span>
              )}
            </label>

            {field.type === 'string' && (
              <input
                type="text"
                id={fieldId}
                name={field.key}
                required={field.required}
                value={fieldValue || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                maxLength={field.maxLength}
                className="input-field min-h-[44px] touch-manipulation"
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                id={fieldId}
                name={field.key}
                required={field.required}
                value={fieldValue || ''}
                onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
                className="input-field min-h-[44px] touch-manipulation"
                placeholder={`Enter ${field.label.toLowerCase()}`}
              />
            )}

            {field.type === 'boolean' && (
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={fieldId}
                  name={field.key}
                  checked={fieldValue || false}
                  onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-white">{field.helpText || 'Enable'}</span>
              </label>
            )}

            {field.type === 'enum' && field.options && (
              <select
                id={fieldId}
                name={field.key}
                required={field.required}
                value={fieldValue || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="input-field min-h-[44px] touch-manipulation"
              >
                <option value="">Select {field.label.toLowerCase()}...</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'list' && (
              <div className="space-y-2">
                {field.key === 'subject.product.keyPoints' ? (
                  // Special handling for Description field - multiline textarea
                  <>
                    <textarea
                      id={fieldId}
                      name={field.key}
                      required={field.required && (!fieldValue || fieldValue.length === 0)}
                      value={Array.isArray(fieldValue) ? fieldValue.join('\n') : (fieldValue || '')}
                      onChange={(e) => {
                        const lines = e.target.value
                          .split('\n')
                          .map((v) => v.trim())
                          .filter((v) => v.length > 0)
                          .slice(0, field.maxItems || Infinity);
                        handleFieldChange(field.key, lines);
                      }}
                      rows={5}
                      className="input-field min-h-[100px] touch-manipulation resize-y"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                    {field.maxItems && (
                      <p className="text-xs text-gray-400">
                        Maximum {field.maxItems} items. Enter each item on a new line.
                      </p>
                    )}
                  </>
                ) : (
                  // Default list handling - comma-separated input
                  <>
                    <input
                      type="text"
                      id={fieldId}
                      name={field.key}
                      required={field.required && (!fieldValue || fieldValue.length === 0)}
                      value={Array.isArray(fieldValue) ? fieldValue.join(', ') : (fieldValue || '')}
                      onChange={(e) => {
                        const values = e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter((v) => v.length > 0)
                          .slice(0, field.maxItems || Infinity);
                        handleFieldChange(field.key, values);
                      }}
                      className="input-field min-h-[44px] touch-manipulation"
                      placeholder={`Enter ${field.label.toLowerCase()} separated by commas${field.maxItems ? ` (max ${field.maxItems})` : ''}`}
                    />
                    {field.maxItems && (
                      <p className="text-xs text-gray-400">
                        Maximum {field.maxItems} items. Separate with commas.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

