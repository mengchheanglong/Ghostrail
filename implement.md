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
- **browser-flow tests for saved-pack action buttons (Playwright, B13-browser): re-run, delete confirmation, duplicate**
- **starring saved packs (☆/★ toggle, sidebar indicator, PATCH starred)**
- **archiving saved packs (archive/unarchive toggle, hidden by default, PATCH archived)**
- **"Show archived" toggle in sidebar reveals archived packs**

## Current verified baseline
- POST /api/intent-pack works
- GET /api/intent-packs works
- GET /api/intent-packs/:id works
- GET /api/intent-packs/:id/export-issue works (includes notes, tags, and repositoryContext when present)
- POST /api/intent-pack/export-issue works
- DELETE /api/intent-packs/:id works
- PATCH /api/intent-packs/:id works (notes, tags, goal, repositoryContext, starred, archived; normalized/validated)
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
- UI saved-pack action flows covered by 5 Playwright browser-flow tests (re-run prefill, re-run + generate, delete cancel, delete confirm, duplicate)
- re-run button updates correctly after goal is edited
- draft hint shows the source pack's goal after re-run
- GitHub Issue markdown export includes tags line when present
- GitHub Issue markdown export includes notes section when present
- GitHub Issue markdown export includes repositoryContext section when present
- UI supports starring (☆ Star / ★ Unstar button; ★ indicator in sidebar; PATCH starred)
- UI supports archiving (Archive / Unarchive button; archived packs hidden by default; "Show archived" toggle reveals them)
- older packs without starred/archived load safely
- build passes
- all 79 unit/integration tests pass
- all 12 browser tests pass

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
- Slice: B13 — Pack starring and archiving
- Why this was the right next move: pack list was growing and needed lightweight curation; starring lets users mark important packs; archiving hides stale packs without deleting them; reused existing PATCH, sidebar, and filter patterns exactly; single coherent subsystem slice; all verification passed in one run
- Files changed:
  - `src/core/types.ts` — added `starred?: boolean` and `archived?: boolean` to `StoredIntentPack`
  - `src/core/intentPackStore.ts` — widened `patchIntentPack` patch type; starred/archived stored as `true` or deleted (field absent when false) for clean JSON
  - `src/core/handler.ts` — PATCH route validates starred/archived as booleans (400 on non-boolean)
  - `public/index.html` — CSS for `.btn-star`, `.btn-archive`, `.star-indicator`, `.archived-indicator`, `.pack-item-archived`, `.show-archived-row`; "Show archived" checkbox in sidebar; `#starBtn` / `#archiveBtn` in detail actions; `showArchived` state; `updateCurationBtns()` helper; `getFilteredPacks()` filters archived by default; `renderPackList()` shows ★ and "archived" badge; `selectPack()` / `clearDetail()` updated; event listeners for star, archive, show-archived; `renderPackList([])` now clears innerHTML for correct DOM count
  - `src/intentPackStore.test.ts` — 6 new unit tests: starred true/false, archived true/false, older packs without fields, isolation from other fields
  - `src/server.test.ts` — 4 new integration tests: PATCH starred true, PATCH archived true, 400 non-boolean starred, 400 non-boolean archived
  - `tests/browser/curation.spec.ts` (new) — 3 browser tests: star toggle updates button + shows ★ indicator; archive hides pack from default list; show-archived toggle reveals archived pack + shows "archived" badge
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (79/79 unit+integration tests; +10 from B13-browser baseline of 69)
  - `npx playwright test` passes (12/12 browser tests; +3 curation tests; ~5s)
- Result: working
- Rollback path: revert 7 files, remove `tests/browser/curation.spec.ts`

### Previous completed slice (B13-browser)
- Slice: B13-browser — Browser-flow tests for saved-pack action buttons (re-run, delete confirmation, duplicate)
- Why this was the right next move: Playwright infrastructure was already in place from B12; three high-value UI action flows (re-run, inline delete, duplicate) were still manually verified only; adding tests in an existing spec directory required no new dependencies or configuration; single coherent test-only slice with clear verification
- Files changed:
  - `tests/browser/actions.spec.ts` (new) — 5 browser-flow tests: re-run prefills form + shows draftHint; re-run then generate creates a new pack; delete first click shows confirm state and cancel resets it; delete confirm removes pack and shows empty state; duplicate creates new pack with new ID while original remains
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (69/69 tests; unchanged)
  - `npm run test:browser` passes (9/9 browser-flow tests; ~4.3s)
- Result: working
- Rollback path: remove `tests/browser/actions.spec.ts`

### Previous completed slice (B12)
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

### Current recommended next slice
- B14 — Export or sharing improvements, or a "view all" / paginated pack list once the list grows long
- Why now: B13 is complete; the next highest-ROI step is either better export UX (copy-friendly formats) or list management as packs accumulate
- Stop-line: do not begin a new slice in this session

## If blocked
If blocked, stop and write:
- what blocked progress
- whether the block is technical or product ambiguity
- the smallest next human decision needed
