# backlog.md

## Rules
- Keep items small and concrete
- Prefer user-visible value or important safety/reliability value
- Do not treat this as a brainstorming dump
- Only keep real next-step candidates here

## Ready
These are good candidates for the next bounded slice.

### B1 — Persist repositoryContext
- Value: preserves more generation context
- Scope: stored type, save path, read path, detail UI, tests
- Risk: low
- Verification: build + tests + manual UI check

### B2 — Search/filter saved packs
- Value: improves usability once pack count grows
- Scope: client-side filter only
- Risk: low
- Verification: manual UI check + build

### B3 — Delete saved pack
- Value: pack lifecycle management
- Scope: delete endpoint + UI delete action + tests
- Risk: medium
- Verification: create, delete, verify absence

### B4 — Responsive mobile layout
- Value: makes UI usable on narrow screens
- Scope: CSS/layout only
- Risk: low
- Verification: manual responsive check

### B5 — Export route integration coverage
- Value: reliability
- Scope: test only
- Risk: low
- Verification: tests pass

## In progress
Move an item here only if a single active slice is currently being worked.

## Blocked
Move an item here if it needs user/product input.

## Done
Move completed items here with short completion notes.