# Launch Runbook — AvatarPitch × Watch Tower go-live

**Architecture (Ashok's ruling): the ThinkPad hosts ONLY the Watch Tower.** AvatarPitch
runs on its own machine and consumes tower data exclusively through the partner API over
`https://tower.jobmaster.agency/api/partner/v1`.

End state = the joint Definition of Done: **one reel produced from live tower data,
downloaded on the iPhone.**

---

## Phase 1 — Tower live on the ThinkPad  ✅ DONE (verified 2026-08-14)

Tower PR #59 merged, `PARTNER_API_TOKEN` set in `job_engine/.env`, tunnel hostname up.
Verified from an external machine with the token:

- `/health` → `{"ok":true,"jobs_total":5104,...}` (fresh scrape same day)
- `/reel-suggestions` → live ranked skills (excel, python, sql, ...)
- `/jobs?skill=sql` → render-ready cards, day-old postings
- Wrong token → 401. No token → locked.

## Phase 2 — Run AvatarPitch (any machine EXCEPT the ThinkPad)

Works today on a dev laptop; permanent host decision pending (see §Permanent host in
`avatarpitch-runtime.md`).

```bash
# 1. Merge AvatarPitch PR #18, then on the machine of choice:
git clone https://github.com/akayatgit/avatarpitch && cd avatarpitch

# 2. Create .env.local — ONE required line (token mirrored from job_engine/.env):
echo 'PARTNER_API_TOKEN=<the token>' > .env.local
#    Everything else has working defaults: tower URL = tunnel hostname,
#    DB and uploads auto-create under <repo>/.data/ on a dev machine.

# 3. Build & start
npm install && npm run build
npx next start -p 3001

# 4. Verify the full chain (second terminal) — proves app → token → tower → live data:
curl -s http://127.0.0.1:3001/api/job-reel/tower-suggestions
#    expect {"success":true,"suggestions":[{"skill":"excel",...  + health block
```

## Phase 3 — The first reel (Definition of Done)

Open `http://127.0.0.1:3001/app/job-reel` (same machine) or `http://<machine-LAN-ip>:3001/app/job-reel`
from the iPhone on the same Wi-Fi:

1. **Background:** copy a pin link in the Pinterest app → tap "Paste Pinterest link"
2. **Hook:** prefilled ("Know SQL?" etc.) — adjust if desired
3. **Job cards:** tap a skill chip → "Fill cards from live jobs" (cards fill verbatim from live tower data)
4. **Video:** Render → wait or leave the app → come back → **Download** (within 48h)
5. Report Done to both agents. That download — not merged code — closes the slice.

## Phase 4 — Permanent host (pending Ashok's YES)

Recommended: small Linux VPS (persistent disk + ffmpeg + public HTTPS hostname).
Identical code, identical env, plus the systemd unit from `avatarpitch-runtime.md`.
Serverless (Vercel) cannot host this stack: no persistent disk for SQLite/uploads,
render time limits.

---

## Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| Auto-fill panel says "Watch Tower API not reachable" | Tower down/deploying | Wait a minute; check the tower service on the ThinkPad |
| Error mentions "rejected the partner token (401)" | Token doesn't match `job_engine/.env` | Re-copy the exact value into `.env.local`, restart the app |
| Error mentions "PARTNER_API_TOKEN is not set" | `.env.local` missing/typo | Fix the file, restart the app |
| Cards fill but logos are name-boxes | Known tower-side issue (unsigned LinkedIn URLs, 403 for everyone) | Fix requested tower-side; cards render fine meanwhile |
| Reel download link 404s | File past the 48h GC window | Re-render — job data and project state persist |
| Port 3001 already in use | Another process on the port | Start with a different `-p` |
