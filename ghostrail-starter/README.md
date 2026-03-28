# Ghostrail

Ghostrail is an **AI-native guardrail layer for coding agents**.

It turns vague feature requests into a structured **Intent Pack** that both humans and AI agents can use:

- objective
- non-goals
- constraints
- acceptance criteria
- touched areas
- risks
- open questions

The point is simple: AI can generate code fast, but teams still lose time reviewing unclear pull requests, reconstructing why changes were made, and figuring out what must **not** change.

Ghostrail tries to solve that.

## Why this project

Recent GitHub guidance makes it clear that Copilot coding agent works best on **incremental, clearly scoped tasks**, and that repository instructions, tests, and validation make better pull requests more likely. Meanwhile, GitHub has also warned maintainers that AI is increasing contribution volume faster than review capacity. The result is a gap: code creation is cheaper, but code review and intent preservation are still expensive.

Ghostrail is designed to sit in that gap.

## What exists today

This starter repo includes:

- a zero-dependency TypeScript backend
- a tiny web UI
- a heuristic Intent Pack generator
- a clean domain model for future AI integration
- initial docs so GitHub Copilot Agent can keep building from here

## What is intentionally missing

This is a **foundation**, not the full product.

Not built yet:

- real LLM provider integration
- GitHub App integration
- PR diff analysis
- contract drift detection
- review evidence timeline
- policy engine
- repository-level memory

## Quick start

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:3000
```

## API

### `GET /api/health`
Returns a health response.

### `POST /api/intent-pack`
Body:

```json
{
  "goal": "Add subscription upgrades but do not break current billing or admin flows.",
  "repositoryContext": "Node backend with payments, analytics, and admin dashboard."
}
```

Response: structured Intent Pack JSON.

## Suggested next builds

1. replace heuristic generation with real model-backed extraction
2. save Intent Packs to disk or SQLite
3. compare pull requests against Intent Packs
4. create GitHub issue and PR workflows
5. add policy checks for protected files and protected behaviors
6. generate agent-facing task packets from each Intent Pack

## Copilot workflow

The repo is set up so you can push it to GitHub and then give Copilot Agent small, concrete tasks from `docs/COPILOT_TASKS.md`.
