# AvatarPitch Runtime — Architecture & Operating Manual

**Architecture ruling (Ashok, 2026-08-14): AvatarPitch does NOT run on the ThinkPad.**
The ThinkPad hosts only the Watch Tower. AvatarPitch runs on its own host and talks to
the tower exclusively through the partner API over the public tunnel hostname
(`https://tower.jobmaster.agency/api/partner/v1`) with a bearer token. No shared disk,
no shared services, no database access — the API is the only door.

AvatarPitch has also **exited Supabase completely** (same ruling). It is now fully
self-contained: SQLite for state, local disk for files, ffmpeg for rendering. It runs on
any machine with Node 18+ — a dev laptop today, a small Linux host permanently.

## 1. What replaced Supabase

| Before (Supabase) | Now |
|---|---|
| Managed Postgres (`content_creation_requests`, `content_types`, `generated_images`, `agents`) | **Local SQLite file** (`lib/localDb.ts`, better-sqlite3, WAL mode). Same query interface, zero external services |
| Storage bucket `uploads` (public URLs) | **Local disk**, served by the app itself at `/uploads/<path>` with HTTP Range support (`app/uploads/[...path]/route.ts`) |
| Supabase env vars | Gone. See env contract below |

Job data comes exclusively from `GET /api/partner/v1/*` on the tower (`lib/towerClient.ts`)
with the bearer token — no tower-Postgres credential exists in this app, per the contract.

## 2. Environment contract (`.env.local`)

```bash
# --- Watch Tower partner API (required for auto-fill) ---
PARTNER_API_TOKEN=<mirrored from job_engine/.env on the ThinkPad — never in git>
# Default is the public tunnel hostname; no need to set unless the tower moves:
# TOWER_API_BASE_URL=https://tower.jobmaster.agency/api/partner/v1

# --- Local state & storage ---
# Defaults: <repo>/.data/avatarpitch.db and /srv/avatarpitch/uploads with automatic
# fallback to <repo>/.data/uploads when /srv is absent (e.g. dev laptops).
# Set explicitly on a permanent host:
# AVATARPITCH_DB_PATH=/srv/avatarpitch/data/avatarpitch.db
# STORAGE_DIR=/srv/avatarpitch/uploads
UPLOAD_TTL_HOURS=48                       # Ashok's GC ruling

# --- Only needed for Replicate-based tools (Studio / Drone Shot / Assembly AI) ---
# Replicate must fetch our uploads over the public internet, so absolute URLs are
# required for those tools. Job Reel works fully without this (all-local pipeline).
# PUBLIC_STORAGE_BASE_URL=https://<avatarpitch-public-hostname>

# --- Existing AI keys (unchanged, optional for Job Reel) ---
# OPENAI_API_KEY=...
# REPLICATE_API_TOKEN=...
```

Uploads and the SQLite file are gitignored — **never** committed (source-safety law).

## 3. Run it (any machine)

```bash
npm install
npm run build
npx next start -p 3001
```

First launch creates the SQLite schema and storage directories automatically. No SQL
migrations, no dashboards, no cloud credentials.

## 4. Permanent host (decision pending)

Requirements: Node 18+, persistent disk (SQLite + uploads), ffmpeg-friendly CPU for
renders, a public HTTPS hostname for phone access. A small Linux VPS fits; serverless
platforms (Vercel) do not — no persistent disk, render time limits.

systemd template for whichever Linux host is chosen:

```ini
[Unit]
Description=AvatarPitch (Next.js content studio)
After=network.target

[Service]
WorkingDirectory=/home/<user>/avatarpitch
ExecStart=/usr/bin/npm start -- -p 3001
Restart=on-failure
EnvironmentFile=/home/<user>/avatarpitch/.env.local
Nice=10

[Install]
WantedBy=multi-user.target
```

Guardrails honoured in code regardless of host:

- ffmpeg is capped at `-threads 4` in both render pipelines (Job Reel render, Assembly stitch),
  so renders behave on modest hardware.
- AvatarPitch touches nothing of the tower's: no ThinkPad disk, no `job_engine/.env`,
  no Redis, no Postgres. The partner API is the only door.
- Tower deploys restart tower services only; AvatarPitch retries API calls gracefully and
  the wizard stays usable when the tower is briefly down.

## 5. Garbage collection (48-hour ruling)

- Every uploaded/rendered file is deleted **48 hours after creation** (`UPLOAD_TTL_HOURS`).
- Exception: files referenced by a render currently in progress (project `status = processing`).
- Implementation: throttled sweep (max once/hour) triggered on storage activity — no extra daemon.
- The UI tells users: *"Download within 48 hours — files are auto-cleaned after that."*
  Reels can always be re-rendered; job data lives in the tower DB.

## 6. Phone access

Whatever host AvatarPitch lands on needs one public HTTPS hostname (or LAN IP for
same-network testing). The app uses relative URLs throughout, so it works identically
over localhost, LAN, or any domain without config changes.

## 7. Job Reel auto-fill (tower API integration)

- **"Auto-fill from Watch Tower"** panel in the Job Cards step calls
  `/api/job-reel/tower-jobs` (server-side proxy → tower `/jobs`; token stays server-side).
- Suggestion chips come from tower `/reel-suggestions`; the live-jobs count comes from `/health`.
- Company logos are **mirrored into local uploads at reel-creation time** — mirror failure
  falls back to the company-name text box. (Known tower-side issue: LinkedIn logo URLs are
  currently unsigned and 403 for everyone; fix requested tower-side.)
- Card fields render tower rows **verbatim** (company, role, experience, education) — the
  no-invented-facts law. Users may still edit text before rendering.
