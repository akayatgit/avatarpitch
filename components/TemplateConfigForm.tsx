'use client';

import { useState, useEffect } from 'react';

interface KeyValuePair {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
}

interface SceneBlueprintItem {
  type: string;
  goal: string;
  [key: string]: string; // Allow additional key-value pairs
}

interface TemplateConfigFormProps {
  value: any;
  onChange: (config: any) => void;
}

const defaultConfigValue = {
  version: 1,
  output: {
    sceneCount: 5,
    minSceneSeconds: 3,
    maxSceneSeconds: 7,
    aspectRatio: "9:16",
    style: "UGC"
  },
  workflow: {
    systemPrompt: "You are a video script generator...",
    sceneBlueprint: [
      { type: "hook", goal: "Grab attention" },
      { type: "problem", goal: "Identify pain point" },
      { type: "solution", goal: "Show product solution" },
      { type: "proof", goal: "Demonstrate features" },
      { type: "cta", goal: "Encourage action" }
    ],
    constraints: [
      "No medical/financial promises",
      "No guaranteed results",
      "No competitor mentions"
    ]
  }
};

export default function TemplateConfigForm({ value, onChange }: TemplateConfigFormProps) {
  const [config, setConfig] = useState<any>(value || defaultConfigValue);

  useEffect(() => {
    if (value) {
      setConfig(value);
    }
  }, [value]);

  const updateConfig = (path: string[], newValue: any) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = newValue;
    setConfig(newConfig);
    onChange(newConfig);
  };

  const addKeyValue = (path: string[], key: string, value: any) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (const segment of path) {
      if (!current[segment]) {
        current[segment] = {};
      }
      current = current[segment];
    }
    
    current[key] = value;
    setConfig(newConfig);
    onChange(newConfig);
  };

  const removeKey = (path: string[], key: string) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (const segment of path) {
      current = current[segment];
    }
    
    delete current[key];
    setConfig(newConfig);
    onChange(newConfig);
  };

  const addArrayItem = (path: string[], item: any) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (const segment of path) {
      current = current[segment];
    }
    
    current.push(item);
    setConfig(newConfig);
    onChange(newConfig);
  };

  const updateArrayItem = (path: string[], index: number, item: any) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (const segment of path) {
      current = current[segment];
    }
    
    current[index] = item;
    setConfig(newConfig);
    onChange(newConfig);
  };

  const removeArrayItem = (path: string[], index: number) => {
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (const segment of path) {
      current = current[segment];
    }
    
    current.splice(index, 1);
    setConfig(newConfig);
    onChange(newConfig);
  };

  const addKeyValueToObject = (path: string[], newKey: string, newValue: string, type: 'string' | 'number' | 'boolean') => {
    let parsedValue: any = newValue;
    if (type === 'number') {
      parsedValue = parseFloat(newValue);
    } else if (type === 'boolean') {
      parsedValue = newValue === 'true';
    }
    addKeyValue(path, newKey, parsedValue);
  };

  const renderKeyValueInput = (path: string[], obj: any, label?: string) => {
    const entries = Object.entries(obj);
    
    return (
      <div className="space-y-3">
        {label && (
          <h4 className="text-sm font-semibold text-gray-800 mt-4 mb-2">{label}</h4>
        )}
        {entries.map(([key, val]) => {
          const currentType = typeof val === 'string' ? 'string' : typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'object';
          
          const handleTypeChange = (newType: 'string' | 'number' | 'boolean') => {
            let convertedValue: any = val;
            if (newType === 'string') {
              convertedValue = String(val);
            } else if (newType === 'number') {
              convertedValue = typeof val === 'string' ? parseFloat(val) || 0 : typeof val === 'boolean' ? (val ? 1 : 0) : Number(val) || 0;
            } else if (newType === 'boolean') {
              convertedValue = typeof val === 'string' ? val === 'true' || val === '1' : typeof val === 'number' ? val !== 0 : Boolean(val);
            }
            updateConfig([...path, key], convertedValue);
          };

          return (
            <div key={key} className="flex gap-2 items-start">
              {currentType === 'object' && !Array.isArray(val) ? (
                <div className="flex-1">
                  {renderKeyValueInput([...path, key], val)}
                </div>
              ) : (
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={key}
                    readOnly
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2 bg-gray-50"
                    placeholder="Key"
                  />
                  <select
                    value={currentType}
                    onChange={(e) => handleTypeChange(e.target.value as 'string' | 'number' | 'boolean')}
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  {currentType === 'string' && (
                    <textarea
                      value={val as string}
                      onChange={(e) => updateConfig([...path, key], e.target.value)}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                      placeholder="Value"
                      rows={2}
                    />
                  )}
                  {currentType === 'number' && (
                    <input
                      type="number"
                      value={val as number}
                      onChange={(e) => updateConfig([...path, key], parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                      placeholder="Value"
                    />
                  )}
                  {currentType === 'boolean' && (
                    <select
                      value={(val as boolean).toString()}
                      onChange={(e) => updateConfig([...path, key], e.target.value === 'true')}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => removeKey(path, key)}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>
          );
        })}
        <AddKeyValueForm path={path} onAdd={addKeyValueToObject} />
      </div>
    );
  };

  const AddKeyValueForm = ({ path, onAdd }: { path: string[], onAdd: (path: string[], key: string, value: string, type: 'string' | 'number' | 'boolean') => void }) => {
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [newType, setNewType] = useState<'string' | 'number' | 'boolean'>('string');
    const [isOpen, setIsOpen] = useState(false);

    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          + Add Key-Value Pair
        </button>
      );
    }

    return (
      <div className="flex gap-2 items-start p-2 bg-gray-50 rounded-lg">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Key"
          className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as 'string' | 'number' | 'boolean')}
          className="rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
        {newType === 'string' ? (
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value"
            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
            rows={1}
          />
        ) : newType === 'number' ? (
          <input
            type="number"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value"
            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
          />
        ) : (
          <select
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
          >
            <option value="">Select...</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        )}
        <button
          type="button"
          onClick={() => {
            if (newKey && newValue) {
              onAdd(path, newKey, newValue, newType);
              setNewKey('');
              setNewValue('');
              setIsOpen(false);
            }
          }}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setNewKey('');
            setNewValue('');
          }}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Version */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Version
        </label>
        <input
          type="number"
          value={config.version || 1}
          onChange={(e) => updateConfig(['version'], parseFloat(e.target.value) || 1)}
          className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500 text-base px-4 py-3.5 min-h-[44px] touch-manipulation"
        />
      </div>

      {/* Output Section */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Output</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scene Count
            </label>
            <input
              type="number"
              value={config.output?.sceneCount || 5}
              onChange={(e) => updateConfig(['output', 'sceneCount'], parseFloat(e.target.value) || 5)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Scene Seconds
            </label>
            <input
              type="number"
              value={config.output?.minSceneSeconds || 3}
              onChange={(e) => updateConfig(['output', 'minSceneSeconds'], parseFloat(e.target.value) || 3)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Scene Seconds
            </label>
            <input
              type="number"
              value={config.output?.maxSceneSeconds || 7}
              onChange={(e) => updateConfig(['output', 'maxSceneSeconds'], parseFloat(e.target.value) || 7)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aspect Ratio
            </label>
            <input
              type="text"
              value={config.output?.aspectRatio || "9:16"}
              onChange={(e) => updateConfig(['output', 'aspectRatio'], e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Style
            </label>
            <input
              type="text"
              value={config.output?.style || "UGC"}
              onChange={(e) => updateConfig(['output', 'style'], e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
            />
          </div>
          {renderKeyValueInput(['output'], Object.fromEntries(
            Object.entries(config.output || {}).filter(([k]) => 
              !['sceneCount', 'minSceneSeconds', 'maxSceneSeconds', 'aspectRatio', 'style', 'renderTarget', 'limits', 'cameraPresets'].includes(k)
            )
          ), 'Additional Output Fields')}
        </div>
      </div>

      {/* Workflow Section */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Workflow</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              System Prompt
            </label>
            <textarea
              value={config.workflow?.systemPrompt || ""}
              onChange={(e) => updateConfig(['workflow', 'systemPrompt'], e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
              rows={3}
            />
          </div>

          {/* Scene Blueprint */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Scene Blueprint
              </label>
              <button
                type="button"
                onClick={() => addArrayItem(['workflow', 'sceneBlueprint'], { type: '', goal: '' })}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                + Add Scene
              </button>
            </div>
            <div className="space-y-3">
              {(config.workflow?.sceneBlueprint || []).map((scene: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-gray-600">Scene {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeArrayItem(['workflow', 'sceneBlueprint'], index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Type</label>
                      <input
                        type="text"
                        value={scene.type || ''}
                        onChange={(e) => {
                          const updated = { ...scene, type: e.target.value };
                          updateArrayItem(['workflow', 'sceneBlueprint'], index, updated);
                        }}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Goal</label>
                      <input
                        type="text"
                        value={scene.goal || ''}
                        onChange={(e) => {
                          const updated = { ...scene, goal: e.target.value };
                          updateArrayItem(['workflow', 'sceneBlueprint'], index, updated);
                        }}
                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                      />
                    </div>
                    {/* Additional key-value pairs for scene */}
                    {Object.entries(scene).filter(([k]) => k !== 'type' && k !== 'goal').map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <input
                          type="text"
                          value={key}
                          readOnly
                          className="flex-1 rounded-lg border-gray-300 shadow-sm bg-gray-100 text-sm px-3 py-2"
                        />
                        <input
                          type="text"
                          value={val as string}
                          onChange={(e) => {
                            const updated = { ...scene, [key]: e.target.value };
                            updateArrayItem(['workflow', 'sceneBlueprint'], index, updated);
                          }}
                          className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...scene };
                            delete updated[key];
                            updateArrayItem(['workflow', 'sceneBlueprint'], index, updated);
                          }}
                          className="px-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <AddKeyValueForm
                      path={[]}
                      onAdd={(path, key, value, type) => {
                        const updated = { ...scene };
                        let parsedValue: any = value;
                        if (type === 'number') parsedValue = parseFloat(value);
                        else if (type === 'boolean') parsedValue = value === 'true';
                        updated[key] = parsedValue;
                        updateArrayItem(['workflow', 'sceneBlueprint'], index, updated);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Constraints */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Constraints
              </label>
              <button
                type="button"
                onClick={() => addArrayItem(['workflow', 'constraints'], '')}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                + Add Constraint
              </button>
            </div>
            <div className="space-y-2">
              {(config.workflow?.constraints || []).map((constraint: string, index: number) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => updateArrayItem(['workflow', 'constraints'], index, e.target.value)}
                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeArrayItem(['workflow', 'constraints'], index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Additional workflow fields */}
          {renderKeyValueInput(['workflow'], Object.fromEntries(
            Object.entries(config.workflow || {}).filter(([k]) => 
              k !== 'systemPrompt' && k !== 'sceneBlueprint' && k !== 'constraints'
            )
          ), 'Additional Workflow Fields')}
        </div>
      </div>

      {/* Additional Top-Level Fields */}
      {renderKeyValueInput([], Object.fromEntries(
        Object.entries(config).filter(([k]) => 
          k !== 'version' && k !== 'output' && k !== 'workflow'
        )
      ), 'Additional Top-Level Fields')}
    </div>
  );
}

