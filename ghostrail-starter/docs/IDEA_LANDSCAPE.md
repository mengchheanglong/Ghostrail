# AI-Native Idea Landscape

I cannot prove these ideas do not exist anywhere in the world.
What I *can* say is that these appear underexplored relative to the current market focus on generic copilots, browser agents, and chat wrappers.

## 1. Ghostrail — intent guardrails for coding agents
Turn vague feature requests into machine-usable contracts with non-goals, constraints, acceptance criteria, and drift checks.

Why it stands out:
- directly useful with GitHub Copilot Agent
- narrow enough to ship
- solves a problem that grows as AI PR volume grows

## 2. Countermerge — pre-merge counterfactual simulator
Before merging, simulate likely failure paths and generate a “most probable hidden breakages” report.

## 3. Repo Memory Ledger
Extract assumptions, architectural decisions, and invariants from issues, docs, code comments, and PRs into a living memory layer.

## 4. ShapeShift UI
An app shell whose interface changes based on task, confidence, and user role instead of fixed pages.

## 5. ProofPatch
Require AI-generated PRs to submit evidence: touched surfaces, expected side effects, rollback plan, and test reasoning.

## Recommended pick
Build **Ghostrail** first.

Why:
- strongest fit for your current GitHub Copilot setup
- easiest to hand off incrementally to Copilot Agent
- useful even at a very small scope
- can later expand into ProofPatch and Repo Memory Ledger
