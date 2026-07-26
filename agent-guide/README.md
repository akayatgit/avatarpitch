# Agent Guide — Hauloo Footage Workflows

This folder is the source of truth for product context, reusable tools, and every Master Prompt workflow. Read it before adding a new template.

## Index

| Doc | Purpose |
|-----|---------|
| [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) | Who the avatar is and what we generate |
| [SURREAL_TECH_THEME.md](./SURREAL_TECH_THEME.md) | Shared surrealism mixes + micro/macro tech scale rules |
| [WORKFLOW_GUIDELINES.md](./WORKFLOW_GUIDELINES.md) | How to turn a Master Prompt Book into a workflow |
| [LEARNINGS.md](./LEARNINGS.md) | Hard-won rules from shipping the first workflows |
| [workflows/drone-tracing-shot.md](./workflows/drone-tracing-shot.md) | Drone Tracing Shot definition |
| [workflows/continuous-shot-path.md](./workflows/continuous-shot-path.md) | Continuous Shot with Path definition |

## Mental model

1. Avatar picks a **template** (product name).
2. Under the hood it is a **workflow**: ordered tool steps from the Master Prompt Book.
3. **Tools/APIs are shared** — never duplicate Replicate/OpenAI calls per template.
4. When a new Master Prompt Book arrives, add a workflow definition + studio UI that reuses existing tools.

## Current workflows

- **Drone Tracing Shot** — aerial still → draw path → path-traced FPV prompt → Seedance `[Image1]`
- **Continuous Shot with Path** — scene + object → draw path → continuous beat Master Prompt → Seedance `[Image1]` + `[Image2]`
