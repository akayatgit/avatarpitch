# Project Context

## Who this is for

The **avatar** is a creator who makes Instagram Reels. They need AI-generated footage:

- B-roll
- Explanatory footage
- Motion graphics / AI cinematic shots
- Continuous / FPV / path-guided takes

They pick a **template**, provide inputs, and download a finished clip. Nothing is persisted on the server.

## How the product evolves

1. AI Creators provide a **Master Prompt Book**.
2. Engineering turns that book into a **workflow** (ordered reusable tools + prompt assembler).
3. The avatar sees it as a new selectable template.
4. Later, multi-agent planning may return — but the current system is **template / Master-Prompt workflows**, not the old scene-planner agents.

## Non-goals (for now)

- Database / project persistence
- Auth-gated generation
- Gemini Omni conversational edit loops
- Stitching multiple clips into a final reel editor
