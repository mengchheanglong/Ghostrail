# backlog.md

## Rules
- Keep items small and concrete
- Prefer user-visible value or important safety/reliability value
- Do not treat this as a brainstorming dump
- Only keep real next-step candidates here

## Ready
These are good candidates for the next bounded slice.

### B11 — Extend search/filter to match repositoryContext
- Value: discoverability — repositoryContext is now editable but still not searched; users with context-heavy packs can't find them by context keywords
- Scope: one-line change to `getFilteredPacks()` predicate in `public/index.html`
- Risk: very low (pure client-side filter addition, no server changes)
- Verification: manual filter test in browser

### B12 — Browser-flow tests for inline editors (goal, context, notes, tags)
- Value: safety — UI editing flows have no automated coverage; manual verification only
- Scope: add jsdom or playwright tests for the inline editor interactions
- Risk: medium (requires adding a test dependency)
- Verification: new test suite passes

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

### B10 — Pack metadata editing (goal and repositoryContext)
- Completed: PATCH endpoint extended to accept goal (rejects empty, trims) and repositoryContext (trims, blank clears field); inline edit/save/cancel UI added for both fields in detail view; re-run button updates after goal edit; 12 new tests (69 total).

### B9 — Surface repositoryContext in GitHub Issue markdown export
- Completed: `toGitHubIssueMarkdown` now includes a `## Repository context` section after Tags and before Non-goals when repositoryContext is present and non-blank; backward compatible; 5 new tests.

### B8 — Surface notes and tags in GitHub Issue markdown export
- Completed: `toGitHubIssueMarkdown` now includes a compact Tags line after Objective and a Notes section before Review note when those fields are present; backward compatible; 5 new tests.

### B7 — Pack organization and refinement milestone
- Completed: notes (PATCH + inline editor), tags (PATCH + chip add/remove + server normalization), sidebar tag badges + note indicator, filter extended to match notes/tags, duplicate pack (POST + button), 21 new tests. 48 tests total.
