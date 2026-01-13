# Image Save Issue - Root Cause Analysis

## Problem Statement
Some images are being generated and logged as "saved" in the console, but they are not appearing in the database or UI. Specifically, scenes 1, 2, 3, 5, 8, 10, 15, 16, 18, 20 are missing image URLs despite generation logs showing success.

## Database Structure Analysis

From the provided `generated_output` JSON:
- **Scene 1** (`id: "scene-1"`, `index: 1`): **NO `imageUrls` field** ❌
- **Scene 2** (`id: "scene-2"`, `index: 2`): **HAS `imageUrls: ["https://..."]`** ✅
- **Scene 3** (`id: "scene-3"`, `index: 3`): **NO `imageUrls` field** ❌

## Code Flow Analysis

### 1. Image Generation Flow (`app/api/generate-all-images/route.ts`)

**Lines 123-158**: All image generations run in parallel using `Promise.allSettled`
```typescript
const imagePromises = imageGenerationTasks.map(async ({ sceneIndex, scenePrompt, imageIndex }) => {
  // ... generate image ...
  await saveImageToDatabase(projectId, sceneIndex, imageUrl);
  return { success: true, sceneIndex, url: imageUrl };
});
```

**Critical Issue #1: Concurrent Database Writes**
- Multiple images for the same scene (if `numImages > 1`) call `saveImageToDatabase` simultaneously
- Multiple different scenes also call `saveImageToDatabase` concurrently
- All these calls fetch, modify, and update the same `generated_output` JSONB column

### 2. Database Save Logic (`saveImageToDatabase` function, lines 178-288)

**The Save Process:**
1. **Fetch** current `generated_output` (line 189-193)
2. **Parse** JSON (lines 207-216)
3. **Find scene** by matching `scene.index ?? idx + 1` with `sceneIndex` (lines 223-238)
4. **Add URL** to scene's `imageUrls` array (lines 227-234)
5. **Update** entire `generated_output` JSONB (lines 252-261)

**Critical Issue #2: Race Condition in Scene Matching**
```typescript
const updatedScenes = scenes.map((scene: any, idx: number) => {
  const currentSceneIndex = scene.index ?? idx + 1;
  if (currentSceneIndex === sceneIndex) {
    // Add URL here
  }
  return scene;
});
```

**Problem**: If two concurrent saves happen:
- **Time T1**: Process A fetches `generated_output` → Scene 1 has no `imageUrls`
- **Time T1**: Process B fetches `generated_output` → Scene 1 has no `imageUrls` (same state)
- **Time T2**: Process A adds URL1 to Scene 1, writes back
- **Time T2**: Process B adds URL2 to Scene 1, writes back (overwrites A's change)
- **Result**: Only URL2 is saved, URL1 is lost

**Critical Issue #3: No True Optimistic Locking**
The comment says "Use updated_at as a simple version check" but the code doesn't actually:
- Check `updated_at` before updating
- Compare `updated_at` after fetching to detect concurrent modifications
- Use PostgreSQL row-level locking (`SELECT ... FOR UPDATE`)

The retry mechanism only retries on **errors**, but Supabase doesn't return an error when two concurrent updates overwrite each other - it just silently overwrites.

**Critical Issue #4: Scene Not Found Edge Case**
```typescript
if (!sceneFound) {
  console.error(`[Scene ${sceneIndex}] Scene not found in project ${projectId}`);
  return;
}
```

If the scene matching logic fails (e.g., index mismatch), the function returns early without saving. This could happen if:
- Scene `index` field is missing and array index calculation is wrong
- Scene was deleted/modified between fetch and update
- Scene index doesn't match due to data inconsistency

### 3. Retry Logic Analysis (lines 186-287)

**Current Retry Behavior:**
- Max 5 retries
- Exponential backoff: `retryDelay * (attempt + 1)` = 100ms, 200ms, 300ms, 400ms, 500ms
- Only retries on **errors**, not on **data conflicts**

**Problem**: The retry doesn't help with race conditions because:
1. Supabase doesn't throw an error when concurrent writes overwrite each other
2. The retry fetches fresh data, but by then the other process may have already written
3. There's no version check to detect if data changed between fetch and update

### 4. Frontend Polling Logic (`ProjectResults.tsx`, lines 152-290)

**How Frontend Detects Images:**
1. Polls `/api/project/[id]` every 3 seconds
2. Extracts `imageUrls` from each scene in `generated_output.scenes`
3. Updates `generatedImages` state if URLs change

**Potential Issue**: If the database doesn't have `imageUrls`, the frontend won't show them, even if they were "saved" according to logs.

## Root Cause Hypotheses

### Hypothesis 1: Race Condition (MOST LIKELY) ⚠️
**Scenario**: Multiple `saveImageToDatabase` calls happen concurrently for the same scene or different scenes, causing writes to overwrite each other.

**Evidence**:
- All image generations run in parallel (`Promise.allSettled`)
- Each save fetches, modifies, and writes back the entire JSONB
- No locking mechanism prevents concurrent modifications
- Retry logic doesn't detect data conflicts, only errors

**Why Some Scenes Work and Others Don't**:
- Scene 2 works because it might have been saved when no other concurrent writes were happening
- Scenes 1, 3, 5, 8, 10, 15, 16, 18, 20 failed because they were overwritten by concurrent writes

### Hypothesis 2: Scene Index Mismatch
**Scenario**: The scene matching logic `scene.index ?? idx + 1` fails to find the correct scene.

**Evidence**:
- Scene matching relies on `index` field or array position
- If scenes are reordered or `index` is missing/incorrect, matching fails
- Function returns early with "Scene not found" error

**Why Some Scenes Work and Others Don't**:
- Scenes with explicit `index` field match correctly
- Scenes relying on array index might fail if array order changes

### Hypothesis 3: JSONB Update Failure (Silent)
**Scenario**: Supabase JSONB update succeeds but doesn't actually persist the change due to:
- Transaction isolation issues
- JSONB path resolution problems
- Partial update failures

**Evidence**:
- Logs show "Saved" but database doesn't have the URL
- No error is thrown, so retry doesn't trigger

### Hypothesis 4: Timing Issue - Update Happens Before Scene Exists
**Scenario**: Image generation completes and tries to save before the scene is fully created in `generated_output`.

**Evidence**:
- If `generated_output.scenes` is empty or incomplete when save happens
- `sceneFound` would be false, causing early return

## Data Flow Diagram (Current - Broken)

```
Time    Process A (Scene 1)          Process B (Scene 1)          Database State
----    --------------------          --------------------          --------------
T1      Fetch generated_output       Fetch generated_output       Scene 1: {imageUrls: []}
T2      Add URL1 to Scene 1          Add URL2 to Scene 1          (both have same state)
T3      Write: Scene 1: [URL1]      Write: Scene 1: [URL2]        Scene 1: [URL2] ❌ (URL1 lost)
```

## Why Retry Doesn't Help

The retry mechanism has a fundamental flaw:
1. **It only retries on errors**, but concurrent overwrites don't produce errors
2. **No conflict detection**: It doesn't check if data changed between fetch and update
3. **Same race condition on retry**: Even on retry, the same race condition can occur

## Recommended Solutions (For Future Implementation)

1. **Use PostgreSQL Row-Level Locking**: `SELECT ... FOR UPDATE` to lock the row during update
2. **Use JSONB Array Append**: Use PostgreSQL's `jsonb_set` with array append instead of fetch-modify-write
3. **Use Optimistic Locking**: Check `updated_at` timestamp before and after update
4. **Use Database Transactions**: Wrap fetch-update in a transaction with proper isolation
5. **Use a Queue**: Serialize database writes through a queue instead of parallel execution
6. **Use Supabase RPC**: Create a stored procedure that handles the update atomically

## Key Observations

1. **The logs show "Saved"** because the function returns successfully after the update call, but the update may have been overwritten by a concurrent write
2. **Some scenes work** because they were saved when no concurrent writes were happening
3. **The pattern is non-deterministic** - it depends on timing of concurrent operations
4. **The retry mechanism is ineffective** for this type of race condition because it doesn't detect conflicts

