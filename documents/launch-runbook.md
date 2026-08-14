# Launch Runbook — AvatarPitch × Watch Tower go-live

Ordered steps for Ashok to run on the ThinkPad. End state = the joint Definition of
Done: **one reel produced from live tower data, downloaded on the iPhone.**

Both sides are merged-ready: tower PR #59 (partner API + host setup script) and
AvatarPitch PR #18 (Supabase exit + tower integration). Nothing is exposed until the
token is set — the tower answers 503 without it.

---

## Phase 1 — Tower goes live (~5 min)

```bash
# 1. Merge tower PR #59, deploy the tower as usual (its deploy restarts tower services only)

# 2. One idempotent host-setup run (creates /srv/avatarpitch/{uploads,data},
#    installs the 72h safety-net GC timer + nightly 03:30 pg_dump timer)
cd <job_engine repo>
bash scripts/setup_avatarpitch_host.sh

# 3. Generate the partner token
openssl rand -hex 32

# 4. Put it in job_engine/.env  (never in git)
#    PARTNER_API_TOKEN=<the hex value>
#    ... then restart the tower service.

# 5. Verify the locked door opens for the token only
curl -s http://127.0.0.1:8001/api/partner/v1/health                      # expect 503 or 401
curl -s -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8001/api/partner/v1/health                            # expect {"ok":true,...}
```

## Phase 2 — AvatarPitch goes live (~10 min)

```bash
# 1. Merge AvatarPitch PR #18, then on the ThinkPad:
git clone <avatarpitch repo> ~/avatarpitch   # or git pull if it exists
cd ~/avatarpitch

# 2. Create .env.local (mirror the SAME token):
cat > .env.local <<'ENV'
PARTNER_API_TOKEN=<same hex value as job_engine/.env>
AVATARPITCH_DB_PATH=/srv/avatarpitch/data/avatarpitch.db
STORAGE_DIR=/srv/avatarpitch/uploads
# Optional — only for Studio/Drone/Assembly AI tools (Job Reel needs neither):
# OPENAI_API_KEY=...
# REPLICATE_API_TOKEN=...
ENV

# 3. Build
npm install && npm run build

# 4. Install the systemd unit (full unit file in documents/thinkpad-runtime.md —
#    includes the Nice=10 / CPUWeight=50 guardrails and port 3001)
sudo cp documents-provided-unit /etc/systemd/system/avatarpitch.service   # edit paths/user first
sudo systemctl daemon-reload
sudo systemctl enable --now avatarpitch

# 5. Verify
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/app       # expect 200
curl -s http://127.0.0.1:3001/api/job-reel/tower-suggestions             # expect suggestions JSON
```

## Phase 3 — The first reel (Definition of Done)

1. iPhone on home Wi-Fi → `http://<thinkpad-LAN-ip>:3001/app/job-reel`
2. **Background:** copy a pin link in the Pinterest app → tap "Paste Pinterest link"
3. **Hook:** prefilled ("Know SQL?" etc.) — adjust if desired
4. **Job cards:** tap a skill chip → "Fill cards from live jobs" (cards fill verbatim from tower data, logos mirrored)
5. **Video:** Render → wait or leave the app → come back → **Download** (within 48h)
6. Report Done to both agents. That download — not merged code — closes the slice.

## Phase 4 — Remote access (any time later)

Add a hostname on the existing Cloudflare tunnel: `avatarpitch.jobmaster.agency → 127.0.0.1:3001`,
protected by Cloudflare Access (same OTP gate as the tower). Nothing in the app changes —
URLs are relative and work through the tunnel as-is.

---

## Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| Auto-fill panel says "Watch Tower API not reachable" | Tower down/deploying, or token unset tower-side (503) | Wait a minute; check tower service + `PARTNER_API_TOKEN` in `job_engine/.env` |
| Error mentions "rejected the partner token (401)" | Tokens don't match between the two env files | Re-mirror the same value into both, restart both services |
| Error mentions "PARTNER_API_TOKEN is not set" | AvatarPitch's `.env.local` missing the token | Add it, `sudo systemctl restart avatarpitch` |
| Reel download link 404s | File past the 48h GC window | Re-render — job data and project state persist |
| Port 3001 already in use | Another process on the port | Change the `-p` in the unit + tunnel mapping together |
