# backlog.md

## Rules
- Keep items small and concrete
- Prefer user-visible value or important safety/reliability value
- Do not treat this as a brainstorming dump
- Only keep real next-step candidates here

## Ready
These are good candidates for the next bounded slice.

### B13 — Pack archiving / starring
- Value: curation — allow users to mark a pack as starred or archived; useful when the pack list grows
- Scope: new field on StoredIntentPack, PATCH support, sidebar indicator, optional filter toggle
- Risk: low-medium (new field, new UI toggle, backward-compatible)
- Verification: starred pack shows indicator; filter toggle works; older packs safe

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

### B13-browser — Browser-flow tests for saved-pack action buttons (re-run, delete, duplicate)
- Completed: `tests/browser/actions.spec.ts` added with 5 tests: re-run prefills form, re-run + generate creates new pack, delete cancel path, delete confirm removes pack, duplicate creates new pack with new ID; 9/9 browser tests pass total; 69 unit tests unchanged.

### B12 — Browser-flow tests for inline editors (goal, context, notes, tags)
- Completed: Playwright installed (`@playwright/test` 1.58.2); `playwright.config.ts` added; `tests/browser/editing.spec.ts` added with 4 tests (edit goal, edit repositoryContext, edit notes, add/remove tag); all 4 pass in ~7.6s; 69 existing unit/integration tests unchanged; `npm run test:browser` is the new command.

### B11 — Extend search/filter to match repositoryContext
- Completed: `getFilteredPacks()` predicate extended with one line — repositoryContext now participates in case-insensitive matching; backward-compatible (guard on `p.repositoryContext`); no server changes; 69 tests still pass.

### B10 — Pack metadata editing (goal and repositoryContext)
- Completed: PATCH endpoint extended to accept goal (rejects empty, trims) and repositoryContext (trims, blank clears field); inline edit/save/cancel UI added for both fields in detail view; re-run button updates after goal edit; 12 new tests (69 total).

### B9 — Surface repositoryContext in GitHub Issue markdown export
- Completed: `toGitHubIssueMarkdown` now includes a `## Repository context` section after Tags and before Non-goals when repositoryContext is present and non-blank; backward compatible; 5 new tests.

### B8 — Surface notes and tags in GitHub Issue markdown export
- Completed: `toGitHubIssueMarkdown` now includes a compact Tags line after Objective and a Notes section before Review note when those fields are present; backward compatible; 5 new tests.

### B7 — Pack organization and refinement milestone
- Completed: notes (PATCH + inline editor), tags (PATCH + chip add/remove + server normalization), sidebar tag badges + note indicator, filter extended to match notes/tags, duplicate pack (POST + button), 21 new tests. 48 tests total.
