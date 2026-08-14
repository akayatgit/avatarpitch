# AvatarPitch on the ThinkPad — Runtime & Migration Guide

AvatarPitch has **exited Supabase completely** (Ashok's ruling, 2026-08-14) and now runs
self-contained on the ThinkPad alongside the Watch Tower, consuming job data only through
the tower's partner API. This document is the operating manual.

## 1. What replaced Supabase

| Before (Supabase) | Now |
|---|---|
| Managed Postgres (`content_creation_requests`, `content_types`, `generated_images`, `agents`) | **Local SQLite file** — `/srv/avatarpitch/data/avatarpitch.db` (`lib/localDb.ts`, better-sqlite3, WAL mode). Same query interface, zero coupling to the tower's Postgres |
| Storage bucket `uploads` (public URLs) | **Local disk** — `/srv/avatarpitch/uploads`, served by the app itself at `/uploads/<path>` with HTTP Range support (`app/uploads/[...path]/route.ts`) |
| Supabase env vars | Gone. See env contract below |

Job data comes exclusively from `GET /api/partner/v1/*` on the tower (`lib/towerClient.ts`)
with the bearer token — no Postgres credential exists in this app, per the tower contract.

## 2. Environment contract (`.env.local`)

```bash
# --- Watch Tower partner API (required for auto-fill) ---
PARTNER_API_TOKEN=<set by Ashok; mirrored from job_engine/.env — never in git>
TOWER_API_BASE_URL=http://127.0.0.1:8001/api/partner/v1   # default; override only if the tower moves

# --- Local state & storage (defaults shown) ---
AVATARPITCH_DB_PATH=/srv/avatarpitch/data/avatarpitch.db
STORAGE_DIR=/srv/avatarpitch/uploads
UPLOAD_TTL_HOURS=48                                        # Ashok's GC ruling

# --- Only needed for Replicate-based tools (Studio / Drone Shot / Assembly AI) ---
# Replicate must fetch our uploads over the public internet, so absolute URLs are
# required for those tools. Job Reel works fully without this (all-local pipeline).
# PUBLIC_STORAGE_BASE_URL=https://avatarpitch.jobmaster.agency

# --- Existing AI keys (unchanged) ---
OPENAI_API_KEY=...
REPLICATE_API_TOKEN=...
```

If `/srv/avatarpitch/*` does not exist or is not writable (e.g. a dev machine), the app
falls back to `<repo>/.data/` automatically — which is gitignored (uploads and data are
**never** committed; source-safety law).

## 3. Directories (Ashok creates once)

```bash
sudo mkdir -p /srv/avatarpitch/uploads /srv/avatarpitch/data
sudo chown -R <avatarpitch-user>: /srv/avatarpitch
```

## 4. systemd unit (tower contract §2.4 guardrails)

`/etc/systemd/system/avatarpitch.service`:

```ini
[Unit]
Description=AvatarPitch (Next.js content studio)
After=network.target

[Service]
WorkingDirectory=/home/<user>/avatarpitch
ExecStart=/usr/bin/npm start
Restart=on-failure
EnvironmentFile=/home/<user>/avatarpitch/.env.local
# Renders must LOSE the CPU fight against scraper/Ollama work:
Nice=10
CPUWeight=50

[Install]
WantedBy=multi-user.target
```

Guardrails honoured in code:

- ffmpeg is capped at `-threads 4` in both render pipelines (Job Reel render, Assembly stitch).
- AvatarPitch touches nothing of the tower's: no Chrome profiles, no `job_engine/.env`,
  no `~/.hermes`, no Redis `:6379`, no Postgres `:5433`. The partner API is the only door.
- Tower deploys restart tower services only; AvatarPitch retries API calls gracefully and
  the wizard stays usable when the tower is briefly down.

## 5. Garbage collection (48-hour ruling)

- Every uploaded/rendered file is deleted **48 hours after creation** (`UPLOAD_TTL_HOURS`).
- Exception: files referenced by a render currently in progress (project `status = processing`).
- Implementation: throttled sweep (max once/hour) triggered on storage activity — no extra daemon.
- The tower's independent 72h systemd timer is the safety net if this GC ever breaks.
- The UI tells users: *"Download within 48 hours — files are auto-cleaned after that."*
  Reels can always be re-rendered; job data lives in the tower DB.

## 6. Phone access

Per the tower's recommendation: a second hostname on the existing Cloudflare tunnel —
`avatarpitch.jobmaster.agency → 127.0.0.1:3001` — behind Cloudflare Access (same OTP gate
as the tower). LAN IP (`http://<thinkpad-ip>:3001`) works day one before the hostname exists.

## 7. Job Reel auto-fill (tower API integration)

- **"Auto-fill from Watch Tower"** panel in the Job Cards step calls
  `/api/job-reel/tower-jobs` (server-side proxy → tower `/jobs`; token stays server-side).
- Suggestion chips come from tower `/reel-suggestions`; the live-jobs count comes from `/health`.
- Company logos are **mirrored into local uploads at reel-creation time** (remote LinkedIn
  CDN URLs rot and would taint the overlay canvas) — mirror failure falls back to the
  company-name text box.
- Card fields render tower rows **verbatim** (company, role, experience, education) — the
  no-invented-facts law. Users may still edit text before rendering.

## 8. Run it

```bash
npm install
npm run build
npm start          # or: sudo systemctl start avatarpitch
```

First launch creates the SQLite schema and storage directories automatically. No SQL
migrations, no dashboards, no cloud credentials.
