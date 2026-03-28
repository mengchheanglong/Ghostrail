# Ghostrail repository instructions

You are helping build Ghostrail, an AI-native guardrail layer for coding agents.

## Product intent
The product turns vague human requests into structured Intent Packs that preserve:
- the objective
- non-goals
- constraints
- acceptance criteria
- likely risks
- open questions

## Engineering rules
- Keep the codebase small and understandable.
- Prefer pure functions for domain logic.
- Avoid unnecessary dependencies.
- Do not introduce frameworks unless the task clearly benefits from them.
- Preserve backward compatibility for current API routes unless the task explicitly changes them.
- Add tests whenever adding behavior.
- Keep API responses JSON and deterministic.

## Architectural preference
- Domain logic in `src/core`.
- HTTP layer stays thin.
- Formatting for GitHub or UI export should be separate from extraction logic.
- Future AI-provider integrations should go behind an adapter boundary.

## Product caution
Ghostrail is not just a text generator. It should help humans review and control AI-generated software work.
