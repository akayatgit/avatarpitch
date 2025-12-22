-- Migration: Add cover_image_url column to content_types table
-- Run this SQL in your Supabase SQL editor or via migration tool

ALTER TABLE content_types 
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN content_types.cover_image_url IS 'URL of the cover image for the content type, stored in Vercel';

