# AGENTS.md

## Mission
This repository is developed in small, safe, verifiable slices.

The agent must behave like a disciplined implementation worker:
- read current state first
- choose one bounded slice
- implement only that slice
- verify it
- update handoff/state files
- stop at a clear boundary

Do not behave like an open-ended autonomous planner.
Do not take multiple unrelated tasks in one pass.
Do not perform broad refactors unless the current task explicitly requires it.

## Required reading order
Before making changes, read these files in order:
1. `AGENTS.md`
2. `.github/copilot-instructions.md`
3. `implement.md`
4. `backlog.md`
5. any files directly named in `implement.md`

## Working mode
Always operate in this mode:

1. Understand the current state
2. Identify the next safest high-value slice
3. Make the smallest coherent change that advances the project
4. Verify the result
5. Update state documents
6. Stop cleanly

## Slice selection rules
Choose only one slice per run.

A good slice is:
- small
- useful
- easy to verify
- low-risk
- locally scoped

Prefer:
- missing persistence
- missing tests
- weak UX in an existing surface
- missing API behavior
- broken or incomplete flows
- safety hardening
- state/reporting improvements

Avoid:
- multi-subsystem rewrites
- speculative abstractions
- large framework changes
- unrelated cleanup
- “while I’m here” changes

## Stop conditions
Stop immediately when:
- human product judgment is required
- credentials, secrets, or external access are required
- a broad architecture decision is needed
- verification fails and the fix is no longer a small bounded slice
- the next step would be a second slice instead of finishing the current one
- the task becomes ambiguous

## Output expectations
When done:
- summarize files changed
- summarize what works now
- list verification performed
- update `implement.md`
- update `backlog.md` only if needed
- clearly state the next recommended slice

## Quality bar
Every change should be:
- incremental
- understandable
- reversible
- verified
- consistent with existing code style

## Safety rules
- preserve backward compatibility unless explicitly changing behavior
- do not silently delete user data
- do not trust unvalidated input
- keep server logic thin
- prefer pure functions in core logic
- avoid unnecessary dependencies