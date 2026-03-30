# Ghostrail

Ghostrail is an **Intent Guardrail System for AI coding work**.

It keeps AI-generated code changes aligned with human intent — at every stage of the development lifecycle:

- **before coding**: sharpen intent, clarify scope, generate constrained task packets for AI agents
- **during coding**: enforce policy, track lifecycle status, surface protected-area warnings
- **after coding**: compare intended scope against actual code changes, detect drift, and preserve an audit trail
- **across the lifecycle**: keep versioned intent, pack status, and repo memory visible

## The core problem

AI can generate code fast. But teams still lose time:
- reviewing unclear pull requests
- reconstructing why changes were made
- figuring out what must **not** change
- discovering that an agent overreached its intended scope

Ghostrail sits in that gap. Every feature starts with an **Intent Pack** — a structured contract that captures objective, constraints, non-goals, acceptance criteria, touched areas, risks, and open questions. That pack becomes the anchor for everything that follows: task packets handed to agents, status tracking through the workflow, and drift detection after the PR lands.

## What Ghostrail does today

- **Intent Pack generation** — turn vague requests into structured, reviewable packs
- **Local persistence** — save, browse, filter, star, and archive packs
- **Pack editing** — inline edit goal, context, notes, tags, and status
- **Agent Task Packet export** — generate a machine-readable JSON and a copy-ready agent prompt from any saved pack
- **GitHub Issue export** — copy a structured issue body with one click
- **PR Description export** — generate a structured PR description template from a saved pack
- **Pack status lifecycle** — track packs from Draft → Approved → In Progress → Done
- **Version history** — snapshots saved on every meaningful edit; history is queryable
- **PR link and drift detection** — link a PR or diff to a pack and surface scope creep and intent gaps
- **Repo policy / protected areas** — define a `ghostrail-policy.json`; get warnings when packs touch sensitive zones

## Roadmap

See `backlog.md` for the ordered implementation plan across all ten product ideas.

## Quick start

```bash
npm install
npm run build
npm start
```

Then open `http://localhost:3000`.

## API

### Core

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/intent-pack` | Generate and save an Intent Pack |
| `GET` | `/api/intent-packs` | List all saved packs |
| `GET` | `/api/intent-packs/:id` | Get a single pack |
| `PATCH` | `/api/intent-packs/:id` | Update notes, tags, goal, repositoryContext, starred, archived, status |
| `DELETE` | `/api/intent-packs/:id` | Delete a pack |
| `POST` | `/api/intent-packs/:id/duplicate` | Duplicate a pack |

### Export

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/intent-packs/:id/export-issue` | GitHub issue markdown |
| `GET` | `/api/intent-packs/:id/task-packet` | AI agent task packet (JSON + prompt) |
| `GET` | `/api/intent-packs/:id/pr-description` | PR description markdown |

### Guardrail

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/intent-packs/:id/history` | Version history snapshots |
| `POST` | `/api/intent-packs/:id/link-pr` | Link a PR/diff to the pack |
| `GET` | `/api/intent-packs/:id/drift-report` | Scope creep / intent gap analysis |

### Pack generation with body

```json
{
  "goal": "Add subscription upgrades but do not break current billing or admin flows.",
  "repositoryContext": "Node backend with payments, analytics, and admin dashboard."
}
```

## Copilot workflow

Push this repo to GitHub and assign Copilot Agent tasks from `docs/COPILOT_TASKS.md`.
