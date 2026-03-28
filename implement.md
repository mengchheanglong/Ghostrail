# implement.md

## Current mission
Keep Ghostrail moving through small, safe, verifiable slices.

## Current product state
Ghostrail currently supports:
- Intent Pack generation
- local persistence
- saved pack browsing
- detail view
- GitHub issue markdown export
- original goal persistence
- repositoryContext persistence
- search/filter saved packs (matches goal, objective, touchedAreas, notes, tags, repositoryContext)
- delete saved pack (inline two-step confirmation)
- responsive layout
- re-run from saved pack (prefill generator form from a selected pack)
- inline delete confirmation (replaces window.confirm)
- draft hint shows source pack's goal after re-run
- **notes on saved packs (edit/save via PATCH)**
- **tags on saved packs (add/remove via PATCH, normalized server-side)**
- **sidebar shows compact tag chips and note indicator**
- **duplicate pack (POST /api/intent-packs/:id/duplicate)**
- **notes and tags surfaced in GitHub Issue markdown export**
- **repositoryContext surfaced in GitHub Issue markdown export**
- **goal editing on saved packs (inline editor, PATCH on save, rejects empty)**
- **browser-flow tests for inline editors (Playwright, B12)**

## Current verified baseline
- POST /api/intent-pack works
- GET /api/intent-packs works
- GET /api/intent-packs/:id works
- GET /api/intent-packs/:id/export-issue works (includes notes, tags, and repositoryContext when present)
- POST /api/intent-pack/export-issue works
- DELETE /api/intent-packs/:id works
- PATCH /api/intent-packs/:id works (notes, tags, goal, repositoryContext; normalized/validated)
- POST /api/intent-packs/:id/duplicate works
- UI shows saved packs and detail view
- UI supports search/filter (goal, objective, touchedAreas, notes, tags, repositoryContext)
- UI supports inline delete confirmation (two-step, no window.confirm)
- UI supports re-run/prefill from a saved pack
- UI supports notes editing (inline editor, PATCH on save)
- UI supports tags add/remove (chip list, PATCH on change)
- UI sidebar shows compact tag badges and note indicator
- UI supports duplicate pack (POST, refreshes + selects new)
- UI supports goal editing (inline editor, PATCH on save, empty rejected client- and server-side)
- UI inline editors are covered by 4 Playwright browser-flow tests (goal, repositoryContext, notes, tags)
- re-run button updates correctly after goal is edited
- draft hint shows the source pack's goal after re-run
- GitHub Issue markdown export includes tags line when present
- GitHub Issue markdown export includes notes section when present
- GitHub Issue markdown export includes repositoryContext section when present
- build passes
- all 69 tests pass

## Active stop-line
Only take the next safe bounded slice.
Do not do multiple backlog items in one run.

## Selection rule
Choose the highest-ROI task that is:
- low risk
- locally verifiable
- coherent as one slice
- useful immediately

## Constraints
- no framework migration
- no database unless explicitly planned
- no broad refactor
- no unrelated cleanup
- preserve backward compatibility for older stored packs

## Implementation log

### Last completed slice
- Slice: B12 — Browser-flow tests for inline editors (goal, repositoryContext, notes, tags)
- Why this was the right next move: all four inline editing flows were working but only manually verified; adding Playwright tests closes the automated coverage gap; Playwright + system Chrome required no new browser download; single coherent test slice with clear verification
- Files changed:
  - `package.json` — added `"@playwright/test": "^1.58.2"` devDependency; added `"test:browser": "playwright test"` script
  - `playwright.config.ts` (new) — minimal Playwright config; headless; uses system Chrome (`/usr/bin/chromium`); `--no-sandbox` for CI environments; `testDir: "tests/browser"`
  - `tests/browser/editing.spec.ts` (new) — 4 browser-flow tests: edit goal, edit repositoryContext, edit notes, add/remove tag; each test starts a real server with a temp data dir, seeds one pack, drives the UI via Playwright, asserts the updated display value
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (69/69 tests; unchanged)
  - `npm run test:browser` passes (4/4 browser-flow tests; ~7.6s)
- Result: working
- Rollback path: remove `playwright.config.ts`, `tests/browser/editing.spec.ts`, revert `package.json` to remove devDependency and script

### Previous completed slice (B11)
- Slice: B11 — Extend search/filter to match repositoryContext
- Why this was the right next move: repositoryContext was the only persisted, visible, and editable field that was still absent from the client-side filter predicate; one-line addition, zero server impact, zero risk, completes the consistency gap
- Files changed:
  - `public/index.html` — added `if (p.repositoryContext && p.repositoryContext.toLowerCase().includes(q)) return true;` to `getFilteredPacks()`, after the tags line, following the exact same guard pattern as goal/notes
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (69/69 tests; no change to test count — filter logic is browser-only, no practical unit test path without jsdom)
  - Manual verification target: search by repositoryContext substring finds the correct pack; packs without repositoryContext still work; case-insensitive; existing fields unaffected
- Result: working
- Rollback path: remove the single added line from `getFilteredPacks()`

### Previous completed slice (B10)
- Slice: B10 — Pack metadata editing (goal and repositoryContext)
- Why this was the right next move: goal and repositoryContext were already persisted, shown in the detail view, and exported — but read-only after creation; extending PATCH and adding inline editors followed the existing notes/tags pattern exactly; single coherent slice with clear local verification
- Files changed:
  - `src/core/intentPackStore.ts` — widened `patchIntentPack` patch type to include `goal?: string` and `repositoryContext?: string`; empty string on repositoryContext deletes the field via `delete stored.repositoryContext`
  - `src/core/handler.ts` — PATCH route validates goal (rejects non-string → 400 "goal must be a string", rejects empty/whitespace → 400 "goal must not be empty", trims before store); validates repositoryContext (rejects non-string → 400, trims, passes `""` for blank so store removes it)
  - `public/index.html` — added `goalSection` and `contextSection` DOM sections with edit/save/cancel inline editors (mirrors notes pattern); removed goal/context from static `detailContent.innerHTML`; added `renderGoalSection`/`renderContextSection` helpers; re-run button state refreshes after goal save; updated `clearDetail` to hide new sections
  - `src/intentPackStore.test.ts` — 4 new unit tests: updates goal, updates repositoryContext, blank repositoryContext removes field, goal patch is isolated from notes/tags
  - `src/server.test.ts` — 8 new integration tests: successful goal update, successful context update, trimming, blank context removal, empty goal 400, whitespace goal 400, non-string goal 400, non-string context 400
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (69/69 tests; +12 from B9 baseline of 57)
- Result: working
- Rollback path: revert 5 files to B9 state, remove 12 new tests

### Previous completed slice (B9)
- Slice: B9 — Surface repositoryContext in GitHub Issue markdown export
- Why this was the right next move: repositoryContext was persisted, shown in the UI, and already exported in notes/tags context — completing this closes the last visible field dropped during export; single-file formatter change, zero-risk
- Files changed:
  - `src/core/issueMarkdown.ts` — widened parameter to include `repositoryContext?: string`; added conditional `## Repository context` section after Tags line and before Non-goals; no change to existing sections
  - `src/generateIntentPack.test.ts` — 5 new tests: repositoryContext present, repositoryContext absent, repositoryContext blank/whitespace, older pack (no repositoryContext) with notes/tags intact, plus extended backward-compat test
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (57/57 tests)
  - CodeQL: 0 alerts
- Result: working
- Rollback path: revert `issueMarkdown.ts` to B8 state, remove 5 new tests

### Previous completed slice (B8)
- Slice: B8 — Surface notes and tags in GitHub Issue markdown export
- Slice: Saved Intent Pack organization and refinement milestone (all 6 subparts)
- Subparts completed:
  1. Notes support — PATCH endpoint + inline editor UI + backward compat
  2. Tags support — PATCH endpoint + chip add/remove UI + server-side normalization
  3. Sidebar visibility — compact tag badges + note indicator (✎) in sidebar list items
  4. Search/filter extended — filter now matches notes and tags
  5. Duplicate pack — POST /api/intent-packs/:id/duplicate + "Duplicate pack" button in detail actions
  6. Automated coverage — 11 new unit tests (store functions) + 10 new integration tests (HTTP routes)
- Files changed:
  - `src/core/types.ts` — added `notes?: string` and `tags?: string[]` to StoredIntentPack
  - `src/core/intentPackStore.ts` — added `patchIntentPack` and `duplicateIntentPack`
  - `src/core/handler.ts` — added PATCH and POST-duplicate routes with input validation
  - `src/intentPackStore.test.ts` — 11 new unit tests for patch and duplicate
  - `src/server.test.ts` — 10 new integration tests for PATCH and POST-duplicate
  - `public/index.html` — notes section, tags section, sidebar tags/indicator, filter extension, duplicate button + all new JS handlers
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (48/48 tests)
  - CodeQL: 0 alerts
  - Code review: 2 issues fixed (XSS via createElement, GOAL_PREVIEW_MAX_LEN constant)
- Result: working
- Rollback path: revert all 6 files to previous state

### Current recommended next slice
- Scope: B12 is now complete — all four inline editing flows have Playwright browser-flow coverage. Good next candidates:
  - Pack archiving / starring — allow marking a pack as starred or archived for better curation
  - Browser test expansion — extend Playwright coverage to delete, duplicate, re-run, and export flows
- Why now: core editing loop and its coverage are complete; next highest-ROI step is either richer curation (starred/archived) or coverage for the remaining UI flows
- Stop-line: do not begin a new slice in this session

## If blocked
If blocked, stop and write:
- what blocked progress
- whether the block is technical or product ambiguity
- the smallest next human decision needed
