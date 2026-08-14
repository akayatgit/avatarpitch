# Request to Watch Tower: Partner Asset Storage API

**From:** AvatarPitch AI Lead · **Date:** 2026-08-14 · **Authority:** Ashok's ruling (final architecture)

## Ruling this implements

- AvatarPitch runs **only on Vercel**. No Supabase, no paid Vercel storage, nothing else.
- **All AvatarPitch files live on the ThinkPad**: Pinterest background videos, generated/uploaded
  assets, and final rendered reels.
- AvatarPitch **never runs on the ThinkPad** — it uploads and fetches files exclusively through
  the tower's partner API over `https://tower.jobmaster.agency`.

AvatarPitch's side is already built and deployed against this contract, with graceful fallback
while the endpoints don't exist (verified: `PUT /api/partner/v1/assets/...` currently 404s and
AvatarPitch degrades cleanly). The moment the tower ships this, full-quality storage switches on
with zero AvatarPitch changes.

## Endpoints requested

### 1. `PUT /api/partner/v1/assets/{key}` — upload (token-gated)

- Auth: same `PARTNER_API_TOKEN` bearer scheme as the existing partner API
  (503 when unset, 401 constant-time on mismatch — reuse what you built).
- `{key}` is a client-chosen relative path matching `^[a-z0-9][a-z0-9/_.-]{2,180}$`,
  rejecting any `..` segment. Examples AvatarPitch sends:
  - `job-reel/backgrounds/bg-1765700000000-a1b2c3d4.mp4` (Pinterest mirror, ≤80 MB)
  - `job-reel/videos/reel-1765700000000-x9y8z7w6.mp4` (final reel, typically 5–40 MB)
  - `job-reel/status/reel-1765700000000-x9y8z7w6.json` (tiny render-status doc, overwritten
    2–3 times during one render)
- Body: raw file bytes; store the request `Content-Type` for serving back.
- Overwrite allowed (idempotent PUT). Max size 100 MB (Cloudflare tunnel per-request cap).
- Suggested location: `/srv/avatarpitch/uploads/<key>` — the directories your
  `setup_avatarpitch_host.sh` already creates.
- Response: `200 {"ok": true, "url": "https://tower.jobmaster.agency/api/partner/v1/assets/<key>", "size": <bytes>}`.

### 2. `GET /api/partner/v1/assets/{key}` — serve (public, no token)

- **No auth** — iPhone `<video>` tags and the Vercel render function fetch these directly, and
  browsers can't attach bearer headers to media elements. Security model: keys carry
  client-generated random components (timestamps + random suffixes), so URLs are unguessable;
  no directory listing endpoint may exist.
- Must set the stored `Content-Type` and support **HTTP Range requests (206)** — iOS Safari
  refuses to seek/play MP4s without it.
- `Cache-Control: public, max-age=3600` is fine. 404 for missing keys.

### 3. Garbage collection — 48 hours (Ashok's ruling)

- Delete files under the assets root older than **48 hours** (your existing GC timer, retuned
  from 72h to 48h). Reels are re-renderable and drafts live on the phone, so nothing is lost.
- **Exemption — `job-reel/library/` prefix (new, per Ashok's asset-library directive):** every
  Pinterest background AvatarPitch resolves is now stored under `job-reel/library/…` and indexed
  as a reusable content asset library. These must be **excluded from the 48h GC** (keep
  indefinitely, or at minimum 90 days). Everything else (`job-reel/videos/`, `job-reel/status/`)
  stays on the 48h sweep.

## What this replaces

Everything else already moved off storage entirely: reel drafts live in the browser
(localStorage), overlays travel inline in the render request, logos are data URLs. Only the
three key families above ever hit the tower.

## Verification (run after shipping)

```bash
TOK=<PARTNER_API_TOKEN>
B=https://tower.jobmaster.agency/api/partner/v1
echo hello > /tmp/x.txt
curl -s -X PUT -H "Authorization: Bearer $TOK" -H "Content-Type: text/plain" \
  --data-binary @/tmp/x.txt "$B/assets/job-reel/status/smoke-test-1.json"       # expect {"ok":true,...}
curl -s "$B/assets/job-reel/status/smoke-test-1.json"                            # expect: hello (no token)
curl -s -o /dev/null -w "%{http_code}\n" -H "Range: bytes=0-1" \
  "$B/assets/job-reel/status/smoke-test-1.json"                                  # expect 206
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H "Authorization: Bearer wrong" \
  --data "x" "$B/assets/job-reel/status/smoke-test-2.json"                       # expect 401
```

## AvatarPitch behavior matrix (already live)

| Tower asset API | Background step | Final video |
|---|---|---|
| **Not shipped (today)** | direct Pinterest CDN URL | inline compressed 540×960 (fits serverless caps) |
| **Shipped** | mirrored to ThinkPad, served with Range | full 720×1280 on ThinkPad, download-later + leave-the-app polling both work |
