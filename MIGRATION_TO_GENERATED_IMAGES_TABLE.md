# Migration to Generated Images Table

## Overview
We've migrated from storing image URLs in the JSONB `generated_output` column to a separate `generated_images` table. This eliminates race conditions when multiple images are saved concurrently.

## Changes Made

### 1. Database Migration
**File**: `migrations/create_generated_images_table.sql`

Created a new `generated_images` table with:
- `id` (UUID, primary key)
- `content_creation_request_id` (UUID, foreign key to `content_creation_requests`)
- `scene_index` (INTEGER)
- `image_url` (TEXT)
- `image_index` (INTEGER, default 0)
- `created_at` and `updated_at` timestamps
- Unique constraint on `(content_creation_request_id, scene_index, image_index)` to prevent duplicates

### 2. Updated `saveImageToDatabase` Function
**File**: `app/api/generate-all-images/route.ts`

**Before**: Fetched entire `generated_output` JSONB, modified it, and wrote it back (race condition prone)

**After**: Inserts directly into `generated_images` table as a new row. Each insert is atomic, so concurrent inserts don't overwrite each other.

**Key Benefits**:
- No race conditions - each image gets its own row
- Simpler code - no JSON parsing/manipulation
- Better performance - direct row inserts vs JSONB updates
- Automatic duplicate prevention via UNIQUE constraint

### 3. Updated Project API Route
**File**: `app/api/project/[id]/route.ts`

**Before**: Only read `imageUrls` from `generated_output.scenes`

**After**: 
1. Fetches images from `generated_images` table
2. Groups them by `scene_index`
3. Merges them into the scenes from `generated_output`
4. Returns scenes with populated `imageUrls`

This maintains backward compatibility - the frontend still receives scenes with `imageUrls` arrays.

### 4. Updated Regenerate Images API
**File**: `app/api/regenerate-images/route.ts`

**Before**: Cleared `imageUrls` in JSONB by updating `generated_output`

**After**: Deletes rows from `generated_images` table for the specified scene(s)

### 5. Updated `updateProjectImages` Function
**File**: `app/app/actions.ts`

**Before**: Updated JSONB in `generated_output`

**After**: Uses `upsert` to insert/update rows in `generated_images` table

## How It Works

### Saving Images
```typescript
// Each image is saved as a separate row
await supabaseAdmin.from('generated_images').insert({
  content_creation_request_id: projectId,
  scene_index: sceneIndex,
  image_url: imageUrl,
  image_index: imageIndex,
});
```

### Fetching Images
```typescript
// Fetch all images for a project
const { data: images } = await supabaseAdmin
  .from('generated_images')
  .select('scene_index, image_url, image_index')
  .eq('content_creation_request_id', projectId)
  .order('scene_index')
  .order('image_index');

// Group by scene_index
const imagesByScene = new Map<number, string[]>();
images.forEach(img => {
  if (!imagesByScene.has(img.scene_index)) {
    imagesByScene.set(img.scene_index, []);
  }
  imagesByScene.get(img.scene_index).push(img.image_url);
});

// Merge into scenes
scenes.forEach(scene => {
  const sceneIndex = scene.index ?? (idx + 1);
  scene.imageUrls = imagesByScene.get(sceneIndex) || [];
});
```

## Benefits

1. **Eliminates Race Conditions**: Each image insert is atomic - no more lost images from concurrent writes
2. **Better Performance**: Direct row operations vs JSONB manipulation
3. **Easier Querying**: Can query images directly without parsing JSON
4. **Scalability**: Can add indexes, constraints, and relationships easily
5. **Data Integrity**: Foreign key constraints ensure data consistency
6. **Backward Compatible**: Frontend still receives the same data structure

## Migration Notes

- Existing projects with images in JSONB will still work (fallback in project API)
- New images are saved to the new table
- Old images in JSONB are preserved but new images take precedence
- To fully migrate old data, you could write a script to move existing `imageUrls` from JSONB to the new table

## Testing

After deployment, verify:
1. ✅ New images are saved to `generated_images` table
2. ✅ Images appear in UI correctly
3. ✅ Multiple concurrent image generations don't lose data
4. ✅ Regenerate images deletes from table correctly
5. ✅ Project API returns images correctly

