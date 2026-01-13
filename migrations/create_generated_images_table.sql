-- Migration: Create generated_images table
-- This table stores generated images separately to avoid race conditions
-- when multiple images are saved concurrently to the same project

CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_creation_request_id UUID NOT NULL REFERENCES content_creation_requests(id) ON DELETE CASCADE,
  scene_index INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  image_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  
  -- Ensure we don't have duplicate images for the same scene/image_index
  UNIQUE(content_creation_request_id, scene_index, image_index)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_images_request_id ON generated_images(content_creation_request_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_scene_index ON generated_images(content_creation_request_id, scene_index);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at);

-- Add comments for documentation
COMMENT ON TABLE generated_images IS 'Stores generated images for content creation requests, one row per image';
COMMENT ON COLUMN generated_images.content_creation_request_id IS 'Foreign key to content_creation_requests table';
COMMENT ON COLUMN generated_images.scene_index IS 'The scene index this image belongs to (1-based)';
COMMENT ON COLUMN generated_images.image_url IS 'URL of the generated image';
COMMENT ON COLUMN generated_images.image_index IS 'Index of the image within the scene (0-based, for multiple images per scene)';

