# backlog.md

## Rules
- Keep items small and concrete
- Prefer user-visible value or important safety/reliability value
- Do not treat this as a brainstorming dump
- Only keep real next-step candidates here

## Ready
These are good candidates for the next bounded slice.

### B8 — Surface notes and tags in GitHub Issue markdown export
- Value: completeness — notes and tags are now saved but not exported
- Scope: `src/core/issueMarkdown.ts` + update markdown test
- Risk: low
- Verification: existing markdown tests pass, new test covers notes/tags sections

## In progress
Move an item here only if a single active slice is currently being worked.

## Blocked
Move an item here if it needs user/product input.

## Done
Move completed items here with short completion notes.

### B1 — Persist repositoryContext
- Completed: repositoryContext is saved and surfaced in list, detail, and export views.

### B2 — Search/filter saved packs
- Completed: client-side filter on goal, objective, and touchedAreas.

### B3 — Delete saved pack
- Completed: DELETE endpoint + UI confirmation + tests.

### B4 — Responsive mobile layout
- Completed: flex stack on screens ≤640px.

### B5 — Export route integration coverage
- Completed: 3 integration tests added for POST /api/intent-pack/export-issue (valid goal, missing goal, whitespace goal). GET export-issue tests were already present. 27 tests now pass.

### B6 — Re-run from saved pack
- Completed: "Re-run from this pack" button in detail view prefills generator form with saved goal and repositoryContext; older packs without goal disable the button gracefully; draftHint confirms the prefill; smooth scroll respects prefers-reduced-motion.

### B7 — Pack organization and refinement milestone
- Completed: notes (PATCH + inline editor), tags (PATCH + chip add/remove + server normalization), sidebar tag badges + note indicator, filter extended to match notes/tags, duplicate pack (POST + button), 21 new tests. 48 tests total.
