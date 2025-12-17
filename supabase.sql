-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed templates (updated for image-first generation)
INSERT INTO templates (name, description, config) VALUES
(
  'UGC Product Demo',
  'User-generated content style product demonstration',
  '{
    "version": 1,
    "output": {
      "sceneCount": 8,
      "minSceneSeconds": 3,
      "maxSceneSeconds": 6,
      "aspectRatio": "9:16",
      "style": "UGC",
      "renderTarget": "image_first_frame",
      "limits": {
        "imagePromptMaxChars": 220,
        "cameraMaxChars": 60,
        "negativesMaxChars": 160,
        "maxSentencesImagePrompt": 2,
        "maxWordsOnScreenText": 6
      },
      "cameraPresets": [
        "CU handheld face",
        "MS handheld",
        "WS establishing",
        "Top-down product",
        "Product macro",
        "Over-shoulder phone",
        "Mirror shot",
        "Shelf product hero",
        "Lifestyle walk-by",
        "Flatlay"
      ]
    },
    "workflow": {
      "systemPrompt": "You are a multi-department ad production pipeline. Each specialist outputs strict JSON only.",
      "shotLibrary": [
        { "type": "hook", "purpose": "Pattern interrupt, curiosity" },
        { "type": "problem_moment", "purpose": "Show pain visually" },
        { "type": "product_reveal", "purpose": "First clear look at product" },
        { "type": "texture_macro", "purpose": "Material detail" },
        { "type": "fit_detail", "purpose": "Fit/finish detail" },
        { "type": "lifestyle_context", "purpose": "Real setting usage" },
        { "type": "social_proof", "purpose": "Compliment/reaction visual" },
        { "type": "price_offer", "purpose": "Offer display moment" },
        { "type": "cta_frame", "purpose": "Final decision frame" }
      ],
      "constraints": [
        "No medical/financial promises",
        "No guaranteed results",
        "No competitor mentions",
        "Output is IMAGE prompts for the FIRST FRAME only (no motion/editing instructions)",
        "Never use headings (###), Objective, Key Elements, Recommendations, or bullet lists in any field.",
        "imagePrompt must be renderer-ready, not an explanation."
      ]
    }
  }'::jsonb
),
(
  'Minimal Studio Showcase',
  'Clean, professional studio-style product showcase',
  '{
    "version": 1,
    "output": {
      "sceneCount": 8,
      "minSceneSeconds": 3,
      "maxSceneSeconds": 6,
      "aspectRatio": "9:16",
      "style": "Studio",
      "renderTarget": "image_first_frame",
      "limits": {
        "imagePromptMaxChars": 220,
        "cameraMaxChars": 60,
        "negativesMaxChars": 160,
        "maxSentencesImagePrompt": 2,
        "maxWordsOnScreenText": 6
      },
      "cameraPresets": [
        "CU handheld face",
        "MS handheld",
        "WS establishing",
        "Top-down product",
        "Product macro",
        "Over-shoulder phone",
        "Mirror shot",
        "Shelf product hero",
        "Lifestyle walk-by",
        "Flatlay"
      ]
    },
    "workflow": {
      "systemPrompt": "You are a multi-department ad production pipeline. Each specialist outputs strict JSON only.",
      "shotLibrary": [
        { "type": "hook", "purpose": "Elegant opening establishing premium quality" },
        { "type": "product_reveal", "purpose": "Sophisticated product presentation" },
        { "type": "texture_macro", "purpose": "Craftsmanship detail" },
        { "type": "fit_detail", "purpose": "Premium finish detail" },
        { "type": "lifestyle_context", "purpose": "Refined setting usage" },
        { "type": "social_proof", "purpose": "Elegant compliment visual" },
        { "type": "price_offer", "purpose": "Exclusive offer display" },
        { "type": "cta_frame", "purpose": "Invitation with refinement" }
      ],
      "constraints": [
        "No medical/financial promises",
        "No guaranteed results",
        "No competitor mentions",
        "Output is IMAGE prompts for the FIRST FRAME only (no motion/editing instructions)",
        "Never use headings (###), Objective, Key Elements, Recommendations, or bullet lists in any field.",
        "imagePrompt must be renderer-ready, not an explanation."
      ]
    }
  }'::jsonb
),
(
  'Before/After Story',
  'Transformation narrative showing before and after states',
  '{
    "version": 1,
    "output": {
      "sceneCount": 8,
      "minSceneSeconds": 3,
      "maxSceneSeconds": 6,
      "aspectRatio": "9:16",
      "style": "Story",
      "renderTarget": "image_first_frame",
      "limits": {
        "imagePromptMaxChars": 220,
        "cameraMaxChars": 60,
        "negativesMaxChars": 160,
        "maxSentencesImagePrompt": 2,
        "maxWordsOnScreenText": 6
      },
      "cameraPresets": [
        "CU handheld face",
        "MS handheld",
        "WS establishing",
        "Top-down product",
        "Product macro",
        "Over-shoulder phone",
        "Mirror shot",
        "Shelf product hero",
        "Lifestyle walk-by",
        "Flatlay"
      ]
    },
    "workflow": {
      "systemPrompt": "You are a multi-department ad production pipeline. Each specialist outputs strict JSON only.",
      "shotLibrary": [
        { "type": "hook", "purpose": "Show the before state or problem dramatically" },
        { "type": "problem_moment", "purpose": "Emphasize the struggle or challenge" },
        { "type": "product_reveal", "purpose": "Introduce product as the turning point" },
        { "type": "texture_macro", "purpose": "Product detail showcase" },
        { "type": "fit_detail", "purpose": "Transformation detail" },
        { "type": "lifestyle_context", "purpose": "After state in real setting" },
        { "type": "social_proof", "purpose": "Transformation reaction visual" },
        { "type": "cta_frame", "purpose": "Invite viewers to start their own transformation" }
      ],
      "constraints": [
        "No medical/financial promises",
        "No guaranteed results",
        "No competitor mentions",
        "Output is IMAGE prompts for the FIRST FRAME only (no motion/editing instructions)",
        "Never use headings (###), Objective, Key Elements, Recommendations, or bullet lists in any field.",
        "imagePrompt must be renderer-ready, not an explanation."
      ]
    }
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_prompt TEXT,
  prompt TEXT,
  temperature NUMERIC(3, 2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on role for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

-- Seed default agents
INSERT INTO agents (name, role, system_prompt, temperature) VALUES
(
  'Fashion Expert',
  'fashion_expert',
  'You are a fashion expert with deep knowledge of trends, styles, and aesthetics. You understand what makes clothing appealing and how to present fashion items in the best light.',
  0.7
),
(
  'Fabrics Expert',
  'fabrics_expert',
  'You are a fabrics and materials expert. You understand textile properties, quality indicators, comfort factors, and how to highlight material benefits.',
  0.7
),
(
  'Sales Person',
  'sales_person',
  'You are a persuasive sales professional. You know how to create compelling offers, highlight value propositions, and create urgency that drives action.',
  0.7
),
(
  'Trend Identifier',
  'trend_identifier',
  'You are a trend identifier who understands current market trends, seasonal patterns, and what resonates with target audiences.',
  0.7
),
(
  'Video Director',
  'video_director',
  'You are a video director specializing in short-form content. You understand camera angles, movements, visual composition, and how to create engaging video sequences.',
  0.7
),
(
  'Copywriter',
  'copywriter',
  'You are a copywriter who crafts compelling on-screen text, captions, and messaging that captures attention and drives engagement.',
  0.7
),
(
  'Brand Strategist',
  'brand_strategist',
  'You are a brand strategist who understands brand positioning, target audience psychology, and how to align product messaging with brand values.',
  0.7
),
(
  'Visual Stylist',
  'visual_stylist',
  'You are a visual stylist who creates beautiful, cohesive visual presentations. You understand color, composition, lighting, and aesthetic appeal.',
  0.7
),
(
  'Creative Strategist',
  'creative_strategist',
  'You are a creative strategist who analyzes products and offers to produce insights and audience angles.',
  0.7
),
(
  'Location Scout',
  'location_scout',
  'You are a location scout who proposes shootable vertical-video locations and props.',
  0.5
),
(
  'Casting Director',
  'casting',
  'You are a casting director who defines realistic UGC cast and performance notes.',
  0.6
),
(
  'Performance Marketer',
  'performance_marketer',
  'You are a performance marketer who defines sell beats, proof types, and CTAs.',
  0.6
),
(
  'Lighting Lead',
  'lighting',
  'You are a lighting lead who specifies practical lighting for before vs after scenarios.',
  0.4
),
(
  'Production Designer',
  'production_design',
  'You are a production designer who defines style cues, camera motifs, and on-screen text styles.',
  0.6
),
(
  'Creative Director',
  'final_assembler',
  'You are a creative director who assembles final scenes and rendering specifications from all department inputs.',
  0.5
),
(
  'Shot Planner',
  'shot_planner',
  'You are a shot planner who decides which shots to use from the shot library for scenes 2-8.',
  0.6
)
ON CONFLICT DO NOTHING;

-- Create default workspace (will be assigned template in bootstrap)
INSERT INTO workspaces (name) VALUES ('default')
ON CONFLICT (name) DO NOTHING;

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  template_name TEXT,
  product_name TEXT NOT NULL,
  product_link TEXT,
  offer TEXT NOT NULL,
  features JSONB,
  target_audience TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('TikTok', 'Reels', 'Shorts')),
  scenes JSONB NOT NULL,
  rendering_spec JSONB NOT NULL,
  video_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Create index on template_id for filtering
CREATE INDEX IF NOT EXISTS idx_projects_template_id ON projects(template_id);

