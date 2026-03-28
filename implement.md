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

## Current verified baseline
Document the last known good state here.

Example:
- POST /api/intent-pack works
- GET /api/intent-packs works
- GET /api/intent-packs/:id works
- GET /api/intent-packs/:id/export-issue works
- UI shows saved packs and detail view
- build passes
- tests pass

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
Describe the last completed slice here.

Template:
- Slice:
- Why this was the right next move:
- Files changed:
- Verification:
- Result:
- Rollback path:

### Current recommended next slice
Describe exactly one next slice.

Template:
- Slice:
- Scope:
- Why now:
- Expected files:
- Verification target:
- Stop-line:

## If blocked
If blocked, stop and write:
- what blocked progress
- whether the block is technical or product ambiguity
- the smallest next human decision needed