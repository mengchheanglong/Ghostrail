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
- search/filter saved packs (matches goal, objective, touchedAreas, notes, tags)
- delete saved pack (inline two-step confirmation)
- responsive layout
- re-run from saved pack (prefill generator form from a selected pack)
- inline delete confirmation (replaces window.confirm)
- draft hint shows source pack's goal after re-run
- **notes on saved packs (edit/save via PATCH)**
- **tags on saved packs (add/remove via PATCH, normalized server-side)**
- **sidebar shows compact tag chips and note indicator**
- **duplicate pack (POST /api/intent-packs/:id/duplicate)**

## Current verified baseline
- POST /api/intent-pack works
- GET /api/intent-packs works
- GET /api/intent-packs/:id works
- GET /api/intent-packs/:id/export-issue works
- POST /api/intent-pack/export-issue works
- DELETE /api/intent-packs/:id works
- PATCH /api/intent-packs/:id works (notes, tags, normalized)
- POST /api/intent-packs/:id/duplicate works
- UI shows saved packs and detail view
- UI supports search/filter (goal, objective, touchedAreas, notes, tags)
- UI supports inline delete confirmation (two-step, no window.confirm)
- UI supports re-run/prefill from a saved pack
- UI supports notes editing (inline editor, PATCH on save)
- UI supports tags add/remove (chip list, PATCH on change)
- UI sidebar shows compact tag badges and note indicator
- UI supports duplicate pack (POST, refreshes + selects new)
- draft hint shows the source pack's goal after re-run
- build passes
- all 48 tests pass

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
- Scope: The product loop is now substantially more complete. Good next candidates:
  - Pack export includes notes and tags in the GitHub Issue markdown (currently the markdown template ignores these fields)
  - Browser-flow tests for notes/tags/duplicate UI interactions (if jsdom or playwright is added)
  - Pack metadata editing (allow editing goal or repositoryContext after creation)
- Why now: notes and tags are persisted and shown but not yet exported — the next logical step is to surface them in the GitHub issue markdown so teams can use them in issue tracking
- Expected files: `src/core/issueMarkdown.ts` (add notes/tags sections), `src/generateIntentPack.test.ts` (extend markdown test)
- Stop-line: do not change the API shape; the export endpoint already returns markdown from `toGitHubIssueMarkdown`

## If blocked
If blocked, stop and write:
- what blocked progress
- whether the block is technical or product ambiguity
- the smallest next human decision needed
