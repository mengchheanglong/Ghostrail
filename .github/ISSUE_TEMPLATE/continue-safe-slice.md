---
name: Continue next safe slice
about: Ask Copilot to continue the next bounded implementation step
title: "Continue next safe bounded slice"
labels: ["copilot", "safe-slice"]
assignees: []
---

## Goal
Continue the next safe bounded slice in this repository.

## Required reading
Before making changes, read:
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `implement.md`
- `backlog.md`

## Instructions
Choose the next highest-ROI task that is:
- small
- coherent
- low-risk
- locally verifiable
- useful immediately

Complete only one slice.

Do not:
- perform a broad refactor
- combine unrelated tasks
- migrate frameworks
- invent new product direction

## Required workflow
1. Read state files
2. Select one slice
3. Implement it
4. Verify it
5. Update `implement.md`
6. Update `backlog.md` if needed
7. Stop at a clear boundary

## Verification
Run the most relevant available verification commands before finishing.

Default expectations:
- tests pass
- build passes

## Expected final output
In the PR, include:
- what slice was chosen
- why it was the right next move
- files changed
- verification performed
- where you stopped
- next recommended slice

## Stop conditions
Stop and report clearly if:
- human decision is needed
- secrets/credentials are needed
- verification fails beyond a small fix
- the next step would become a second slice