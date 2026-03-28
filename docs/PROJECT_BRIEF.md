# Ghostrail Project Brief

## One-line idea
Ghostrail is a GitHub-native control layer that converts messy human requests into living, reviewable change contracts for AI coding agents.

## Why this is promising
Most AI coding tools are getting better at generating code, but the bottleneck is shifting toward:

- unclear intent
- weak reviewability
- hidden risks
- loss of rationale
- PR drift away from the original goal

Ghostrail focuses on that bottleneck.

## The differentiated angle
There are already adjacent tools around specs, repo memory, and guardrails.
Ghostrail is different because it focuses on the combination of:

1. **negative space capture** — explicitly record what should *not* change
2. **agent-facing execution packs** — produce instructions that coding agents can use directly
3. **drift checks** — compare actual code changes against the declared contract
4. **evidence-first review** — show whether the PR really satisfied the original intent

## Initial product wedge
Start with one very narrow workflow:

### v0 workflow
1. User writes a feature request.
2. Ghostrail generates an Intent Pack.
3. Human edits or approves it.
4. Ghostrail generates a GitHub issue body for Copilot.
5. Copilot implements the task.
6. Ghostrail later compares the PR against the original pack.

That wedge is narrow enough to build, but still useful immediately.

## AI-native part
This project is not just “a normal app with AI added.”
It depends on AI for tasks that are awkward without it:

- extracting hidden constraints from vague requests
- surfacing likely risks before implementation
- generating acceptance criteria from plain English
- identifying missing assumptions
- producing task-specific interface blocks or review cards

## Best first users

- solo builders using Copilot, Claude Code, or Codex
- small teams drowning in vague issues and noisy PRs
- maintainers reviewing AI-generated changes

## The real product promise
The real promise is not “generate code faster.”
The promise is:

> keep AI-generated changes aligned with intent.

## v1 features

- editable Intent Pack UI
- saved project memory
- GitHub issue export
- PR summary evaluation
- drift score
- protected file zones
- non-goal violations

## v2 features

- GitHub App that comments on PRs
- evidence timeline from issue → commits → tests → PR
- automatic missing-test warnings
- repository policy packs
- model-provider abstraction

## v3 features

- multi-pack planning for larger features
- dependency-aware touched-area prediction
- “what changed that was never requested?” review mode
- repository memory graph of goals, constraints, and decisions
