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
- **inline delete confirmation (replaces window.confirm)**
- **draft hint shows source pack's goal after re-run**

## Current verified baseline
- POST /api/intent-pack works
- GET /api/intent-packs works
- GET /api/intent-packs/:id works
- GET /api/intent-packs/:id/export-issue works
- POST /api/intent-pack/export-issue works
- DELETE /api/intent-packs/:id works
- UI shows saved packs and detail view
- UI supports search/filter
- UI supports inline delete confirmation (two-step, no window.confirm)
- UI supports re-run/prefill from a saved pack
- draft hint shows the source pack's goal after re-run
- build passes
- all 27 tests pass

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
- Slice: Saved Intent Pack management milestone (subparts 2–4; subpart 1 was pre-completed)
- Subparts completed:
  1. Re-run from saved pack (already complete from prior slice — verified)
  2. Accessible inline delete confirmation replacing window.confirm
  3. Export route integration coverage (3 new tests for POST /api/intent-pack/export-issue)
  4. Draft hint polish — shows source pack's goal after re-run
- Files changed:
  - `public/index.html` — cancelDeleteBtn element + `.btn-cancel` CSS, `pendingDelete` state, two-step delete confirmation handler, cancelDeleteBtn handler, clearDetail/selectPack pending state resets, dynamic draftHint text in prefillFromPack()
  - `src/server.test.ts` — 3 new integration tests for POST /api/intent-pack/export-issue
- Verification:
  - `npm run build` passes (TypeScript, zero errors)
  - `npm test` passes (27/27 tests)
  - CodeQL: 0 alerts
  - Code review: no issues found
- Result: working
- Rollback path: revert `public/index.html` and `src/server.test.ts` to previous state

### Current recommended next slice
- Scope: There are no remaining backlog items marked Ready. Consider:
  - Adding browser-level tests for the inline delete confirmation flow and re-run flow (jsdom or lightweight playwright tests)
  - Or surfacing a new user-visible feature (e.g., pack tagging, pack duplication, or pack notes)
- Why now: the management flow is feature-complete for the current product scope; the remaining gap is browser-flow test coverage
- Expected files: new test file or extended test infrastructure
- Stop-line: do not add a new test framework unless it fits naturally; if not practical, pick the next product feature from the backlog

## If blocked
If blocked, stop and write:
- what blocked progress
- whether the block is technical or product ambiguity
- the smallest next human decision needed
