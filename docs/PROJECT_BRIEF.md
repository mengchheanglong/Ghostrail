# Ghostrail Project Brief

## One-line idea
Ghostrail is an Intent Guardrail System for AI coding work — it keeps AI-generated changes aligned with human intent at every stage of the development lifecycle.

## The product mission
Ghostrail is not just a pre-flight prompt generator.
It is a full guardrail layer:

- **before coding**: sharpen intent, clarify scope, generate constrained task packets
- **during coding**: enforce policy, track status, surface protected-area warnings
- **after coding**: compare intended scope vs actual code changes, detect drift
- **across the lifecycle**: keep versioned intent, status, and repo memory visible

## Why this is necessary
Most AI coding tools are getting better at generating code. The bottleneck is now:

- unclear intent before work starts
- agents that don't know what they must NOT change
- PRs that drift away from the original goal without anyone noticing
- loss of rationale — why was this decision made?
- no structured way to evaluate whether a PR actually satisfied the original intent

Ghostrail is designed to sit in exactly that gap.

## The differentiated angle
There are adjacent tools around specs, repo memory, and guardrails.
Ghostrail is different because it combines:

1. **negative space capture** — explicitly record what should *not* change
2. **agent-facing task packets** — produce structured instructions coding agents can use directly
3. **lifecycle tracking** — packs evolve from Draft to Approved to In Progress to Done
4. **drift detection** — compare actual code changes against the declared contract
5. **policy enforcement** — repo-level rules surface warnings automatically
6. **version history** — intent evolution is preserved and queryable

## Current product state

Built and working:
- Intent Pack generation (heuristic, with planned LLM upgrade path)
- Local persistence with full CRUD
- Saved pack browsing, filtering, starring, archiving
- Pack editing: goal, repositoryContext, notes, tags, status
- Agent Task Packet export (JSON + agent prompt)
- GitHub Issue markdown export
- PR Description markdown export
- Pack status lifecycle (Draft → Approved → In Progress → Done)
- Version history (snapshots on meaningful edits)
- PR link and drift detection foundation
- Repo policy / protected areas (ghostrail-policy.json)

## The target user
- Solo builders using Copilot, Claude Code, or Codex
- Small teams drowning in vague issues and noisy PRs
- Maintainers reviewing AI-generated changes

## The real product promise

> Keep AI-generated changes aligned with intent.
> Make every PR reviewable against a clear, structured contract.

## Ordered implementation roadmap

1. PR Diff vs. Intent Pack drift detection — foundations shipped; full diff engine is next
2. AI Agent Task Packet Generator — shipped
3. LLM integration with pre-generation clarifying questions — backlogged
4. Repo-level constraint policy engine — foundations shipped
5. Live goal quality score — backlogged
6. Protected areas registry — foundations shipped via ghostrail-policy.json
7. Pack status lifecycle — shipped
8. Pack health score with inline improvement suggestions — backlogged
9. One-click GitHub issue + PR description creation — PR description shipped; live GitHub API is next
10. Intent version history with visual diff — foundations shipped; visual diff UI is next

## v1 milestones

- [x] Intent Pack generation and editing
- [x] Agent task packet export
- [x] GitHub issue and PR description export
- [x] Pack status lifecycle
- [x] Version history snapshots
- [x] Drift detection foundation
- [x] Repo policy / protected areas foundation
- [ ] LLM provider integration
- [ ] Live goal quality score
- [ ] Pack health score

## v2 milestones

- GitHub App that comments on PRs
- Evidence timeline: issue → commits → tests → PR
- Automatic missing-test warnings
- Full drift engine (parse actual diffs)
- Model-provider abstraction

## v3 milestones

- Multi-pack planning for larger features
- Dependency-aware touched-area prediction
- Repository memory graph of goals, constraints, and decisions
