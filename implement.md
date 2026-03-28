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
- search/filter saved packs
- delete saved pack
- responsive layout
- **re-run from saved pack (prefill generator form from a selected pack)**

## Current verified baseline
- POST /api/intent-pack works
- GET /api/intent-packs works
- GET /api/intent-packs/:id works
- GET /api/intent-packs/:id/export-issue works
- DELETE /api/intent-packs/:id works
- UI shows saved packs and detail view
- UI supports search/filter
- UI supports delete with confirmation
- UI supports re-run/prefill from a saved pack
- build passes
- all 24 tests pass

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
- Slice: Re-run from saved pack
- Why this was the right next move: uses already-persisted goal and repositoryContext fields, closes the main product loop by letting users iterate on existing packs without copy-paste, stays inside the existing UI flow, locally verifiable, no backend changes needed
- Files changed:
  - `public/index.html` — added "Re-run from this pack" button in detail actions, `draftHint` hint text near generator form, `btn-rerun` and `draft-hint` CSS classes, `rerunBtn`/`draftHint` DOM refs, `selectedPack` state variable, `prefillFromPack()` helper, re-run click handler, `clearDetail()` reset, `draftHint` clear on successful generate
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (24/24 tests)
  - Manual flow: selecting a pack with goal enables the button, clicking it fills both fields and scrolls to the form; older packs without goal disable the button with a tooltip; editing prefilled fields works; generating creates a new pack; draftHint disappears after generate
- Result: working
- Rollback path: revert `public/index.html` to previous state

### Current recommended next slice
- Slice: Add tests for the `prefillFromPack` logic (or document why they are not practical in this setup)
- Scope: The `prefillFromPack` function is inline DOM-manipulation JS inside `index.html`. If a lightweight headless browser test harness (e.g. `jsdom` or `playwright`) is added, it could be unit/integration tested. Otherwise, this slice is documenting the gap and adding a comment in the test file noting browser-flow tests are deferred.
- Why now: the new re-run flow has no automated test coverage; the next safest slice is either adding that coverage or picking the next backlog item (B5 — export route integration coverage) which is already testable
- Expected files: new or extended test files
- Verification target: new tests pass alongside existing 24
- Stop-line: do not add a new test framework unless it fits naturally; if not practical, pick B5 instead

## If blocked
If blocked, stop and write:
- what blocked progress
- whether the block is technical or product ambiguity
- the smallest next human decision needed
