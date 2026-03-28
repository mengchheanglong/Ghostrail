# Ghostrail repository instructions

You are helping build Ghostrail, an AI-native guardrail layer for coding agents.

## First priority
Before making changes, read:
- `AGENTS.md`
- `implement.md`
- `backlog.md`

Do not start coding before reading them.

## Product intent
Ghostrail turns vague human requests into structured Intent Packs that preserve:
- the objective
- non-goals
- constraints
- acceptance criteria
- likely risks
- open questions

Ghostrail is not just a text generator.
It should help humans review, constrain, and control AI-generated software work.

## Core working mode
Your job is to complete the next safe, bounded, verifiable slice.

Do not:
- improve the whole repo at once
- take multiple unrelated tasks in one pass
- do broad refactors unless the task clearly requires them
- silently change product direction

## Engineering rules
- Keep the codebase small and understandable.
- Prefer pure functions for domain logic.
- Avoid unnecessary dependencies.
- Do not introduce frameworks unless the task clearly benefits from them.
- Preserve backward compatibility for current API routes unless the task explicitly changes them.
- Add tests whenever adding behavior.
- Keep API responses JSON and deterministic.

## Architectural preference
- Domain logic belongs in `src/core`.
- HTTP/server handlers should stay thin.
- Formatting for GitHub or UI export should be separate from extraction logic.
- Future AI-provider integrations should go behind an adapter boundary.

## Implementation discipline
- Complete only one coherent slice per run.
- Prefer the highest-ROI low-risk task.
- Reuse existing patterns.
- Keep naming clear and boring.
- Avoid speculative abstractions.
- Avoid framework migration.
- Do not mix feature work with unrelated cleanup.

## Verification discipline
Before finishing:
- run the relevant tests
- run the build if available
- verify the changed flow works
- if verification fails, either fix it within the same bounded slice or stop and report the wall

## State file discipline
Before finishing, update `implement.md` with:
- what was attempted
- what was completed
- what was verified
- where work stopped
- the next recommended slice

Update `backlog.md` only when:
- a backlog item was completed
- a new real follow-up task was discovered
- a backlog item is no longer relevant

## Stop conditions
Stop immediately when:
- human product judgment is required
- credentials, secrets, or external access are required
- a broad architecture decision is needed
- verification fails beyond a small bounded fix
- the next step would become a second slice
- the task becomes ambiguous

## Preferred finish format
Include:
1. Summary
2. Files changed
3. Verification
4. Stop-line
5. Next recommended slice