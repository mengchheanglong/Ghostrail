# implement.md

## Current milestone
**Goal-shift + Foundation Milestone** — Intent Guardrail System

## What was attempted
Complete a "goal-shift + foundation" milestone across all 7 ordered phases:
- Phase 0: Product shift and doctrine update
- Phase 1: Agent Task Packet Generator
- Phase 2: Pack status lifecycle
- Phase 3: GitHub workflow bridge (PR description)
- Phase 4: Intent version history foundation
- Phase 5: Drift detection foundation
- Phase 6: Repo policy / protected areas foundation
- Phase 7: Backlog remaining intelligence features as concrete entries

## What was completed

### Phase 0 — Product shift and doctrine update ✅
- `README.md` — rewritten to reflect Ghostrail as a full Intent Guardrail System
- `docs/PROJECT_BRIEF.md` — rewritten with new product mission, current state, and ordered roadmap
- `backlog.md` — rewritten with all 10 ideas as an ordered implementation roadmap, with dependencies, next steps, and blocked items
- `implement.md` — updated (this file)

### Phase 1 — Agent Task Packet Generator ✅
- New `src/core/taskPacket.ts` with:
  - `toTaskPacketJson()` — machine-readable JSON task packet (schemaVersion, id, goal, objective, constraints, nonGoals, acceptanceCriteria, touchedAreas, risks, openQuestions, repositoryContext, createdAt)
  - `toAgentPrompt()` — deterministic copy-ready agent prompt with checklist-format acceptance criteria
- New route: `GET /api/intent-packs/:id/task-packet` → `{ packet, prompt }`
- UI: "Copy as Task Packet" button in detail view action row
- Tests: 13 unit tests in `src/taskPacket.test.ts`; 2 integration tests in `src/server.test.ts`

### Phase 2 — Pack status lifecycle ✅
- New `PackStatus` type and `VALID_STATUSES` constant in `src/core/types.ts`
  - Values: `"draft" | "approved" | "in-progress" | "done" | "blocked" | "abandoned"`
  - `status?` on `StoredIntentPack` (optional for backward compat)
- `PATCH /api/intent-packs/:id` validates status against `VALID_STATUSES`
- `patchIntentPack` handles `status` field
- UI: Status dropdown in detail view; status badge in sidebar (non-draft statuses shown)
- Tests: 3 store tests; 2 integration tests

### Phase 3 — GitHub workflow bridge (PR description) ✅
- New `src/core/prDescription.ts` with `toPrDescription()` — structured markdown PR description template
  - Includes: goal as title, objective, repositoryContext, acceptance criteria checklist, touched areas, constraints, non-goals, risks, open questions, notes, pack ID footer
- New route: `GET /api/intent-packs/:id/pr-description` → `{ markdown }`
- UI: "Copy as PR Description" button in detail view action row
- Tests: 13 unit tests in `src/prDescription.test.ts`; 2 integration tests in `src/server.test.ts`
- Note: Live GitHub API integration (issue creation) is blocked on credentials — backlogged as B-GH-LIVE

### Phase 4 — Intent version history foundation ✅
- New `HistoryEntry` type and `appendHistorySnapshot()` (internal) in `src/core/intentPackStore.ts`
- History stored in `{id}.history.json` alongside the pack file
- Snapshots taken on every "meaningful" patch: goal, repositoryContext, notes, tags, status changes
- Curation-only patches (starred, archived) do NOT create history entries
- New `listPackHistory()` exported function
- New route: `GET /api/intent-packs/:id/history` → array of `{ patchedAt, before }` entries
- Tests: 6 store tests; 1 integration test in `src/server.test.ts`
- Visual diff UI is backlogged as B-HISTORY-UI

### Phase 5 — Drift detection foundation ✅
- New fields on `StoredIntentPack`: `prLink?` and `changedFiles?`
- New `src/core/driftReport.ts` with `computeDriftReport()`:
  - Accepts pack with linked PR metadata
  - Returns `{ packId, prLink, hasLinkedPr, scopeCreep[], intentGap[], summary }`
  - `scopeCreep`: changed files that don't match any touchedArea (token-based matching)
  - `intentGap`: touchedAreas with no matching changed file
  - Conservative: clearly labelled as "possible" to avoid false confidence
- New route: `POST /api/intent-packs/:id/link-pr` body `{ prUrl, changedFiles? }` → updated pack
- New route: `GET /api/intent-packs/:id/drift-report` → drift report
- Tests: 8 unit tests in `src/driftReport.test.ts`; 4 integration tests in `src/server.test.ts`; 4 store tests
- Full diff-text parsing engine is backlogged as B15

### Phase 6 — Repo policy / protected areas foundation ✅
- New `src/core/policy.ts` with:
  - `GhostrailPolicy` interface: `{ protectedAreas?, rules? }`
  - `PolicyRule` interface: `{ ifTouchedAreaIncludes, warn }`
  - `loadPolicy(policyPath?)` — loads and validates ghostrail-policy.json
  - `getPolicy()` — cached loader (reset with `resetPolicyCache()` for tests)
  - `applyPolicy(touchedAreas, policy)` — pure function, returns warning strings
- `createHandler` extended with optional `policyPath` parameter
- Pack generation applies policy if file exists — `policyWarnings` stored on pack
- New `policyWarnings?` field on `StoredIntentPack`
- UI: Policy warnings section in detail view (amber-styled, only shown when warnings exist)
- Tests: 10 unit tests in `src/policy.test.ts`
- Default policy path: `<project-root>/ghostrail-policy.json` (no file = no warnings)
- Policy warning UI acknowledgement gate (before "Approved") is backlogged as B-POLICY-2

### Phase 7 — Backlog intelligence features ✅
- Ideas #3 (LLM clarifying questions), #5 (goal quality score), #8 (pack health score) are concretely documented in `backlog.md` with purpose, dependencies, recommended approach, and next steps

## What was verified
- `npm run build` → passes (tsc, 0 errors)
- `npm test` → 151/151 unit + integration tests pass (was 69 before this milestone)
- `npx playwright test` → 12/12 browser tests pass (all existing flows intact)
- All existing pack behaviors preserved (backward compat: all new fields are optional)

## What was completed (continued)

### B15 — Full drift engine ✅
- New `src/core/diffParser.ts` with `parseGitDiff(diffText)`:
  - Extracts changed file paths from standard git diff text
  - Supports: modified, new, deleted, renamed, and binary files
  - Returns sorted, deduplicated array of paths (strips `a/`/`b/` prefixes)
  - Deterministic; handles empty/whitespace input safely
- New route: `POST /api/intent-packs/:id/analyze-diff` body `{ diffText, prUrl? }`
  - Parses diff, stores changedFiles on the pack, runs `computeDriftReport`
  - Returns `{ report, changedFiles }` — report includes matchedFiles, scopeCreep, intentGap, status, summary
  - Returns 400 for missing/whitespace-only diffText; 404 for unknown pack id
- `driftReport.ts` extended with `matchedFiles`, `status` (`clean`/`warning`/`drift-detected`/`no-data`), and `changedFiles` in result
- UI: "Drift Analysis" section in detail view — paste diff, click Analyze, see matched/unexpected/missing buckets with status badge
- Tests:
  - 15 unit tests in `src/diffParser.test.ts` covering all diff formats, deduplication, sorting, edge cases
  - 7 integration tests in `src/server.test.ts` for the analyze-diff route
  - 4 browser tests in `tests/browser/drift.spec.ts` covering section visibility, empty-input prompt, result rendering, scope-creep bucket

## What was verified
- `npm run build` → passes (tsc, 0 errors)
- `npm test` → 183/183 unit + integration tests pass
- `npx playwright test` → 16/16 browser tests pass (was 12 before B15)
- All existing pack behaviors preserved (backward compat: all new fields are optional)

## What was completed (continued)

### B-POLICY-2 — Policy warning UI acknowledgement ✅
- `public/index.html` changes:
  - CSS: `.policy-warning-indicator` (amber `⚠`) and `.btn-acknowledge` (small amber button)
  - HTML: "Acknowledge Warnings" button (`#acknowledgeWarningsBtn`) added inside `#policyWarnings` section
  - JS: `const acknowledgedPackIds = new Set()` — tracks per-session acknowledged packs
  - Sidebar `renderPackList`: shows `<span class="policy-warning-indicator" title="Unacknowledged policy warnings">⚠</span>` when pack has `policyWarnings` and is not yet acknowledged
  - `renderPolicyWarnings()`: shows/hides the "Acknowledge Warnings" button based on acknowledgement state
  - Status change gate: selecting "Approved" with unacknowledged `policyWarnings` reverts the dropdown and shows an inline error "⚠ Acknowledge policy warnings before approving."
  - Acknowledge button listener: adds pack id to `acknowledgedPackIds`, hides the button, re-renders sidebar (⚠ badge disappears)
- New `tests/browser/policy.spec.ts` — 3 browser tests:
  - `⚠ indicator appears in sidebar for a pack with unacknowledged policy warnings`
  - `selecting Approved with unacknowledged warnings reverts the dropdown and shows an error`
  - `after acknowledging warnings the ⚠ badge disappears and Approved status is allowed`

## What was completed (continued)

### B-QUALITY — Live goal quality score ✅
- New `src/core/goalQualityScore.ts` — pure heuristic scorer:
  - Detects vagueness signals (improve/refactor/optimize/enhance/fix things/make it better/update the system)
  - Detects scope creep signals (and also/as well as/while we're at it/multiple "also" clauses)
  - Rewards constraint language (do not break/preserve/backward compat) and specificity language (because/so that/in order to)
  - Returns score 0–100, level (vague/partial/clear), and actionable suggestions
  - Exported as TypeScript module for unit testing
- `src/goalQualityScore.test.ts` — 20 unit tests covering all signal types, level thresholds, score clamping, edge cases
- `public/index.html` — color-coded quality bar below goal textarea, live-updating on input:
  - 🔴 Vague (< 35) → 🟡 Partial (35–64) → 🟢 Clear (≥ 65)
  - Inline suggestions list shown for vague/partial goals; hidden when Clear
  - Bar hidden until user starts typing
- `tests/browser/quality.spec.ts` — 3 browser tests: bar hidden when empty, Vague for "Improve the dashboard", Clear for well-specified goal

### B-HEALTH — Pack health score (heuristic) ✅
- New `src/core/healthScore.ts` — pure multi-dimension scorer:
  - **Objective Specificity**: goal length, constraint language, vagueness signals
  - **Acceptance Criteria**: count, testable verb coverage, generic phrase detection
  - **Constraint Completeness**: preservation language, non-goal explicitness
  - **Risk Coverage**: count, specific failure modes, sensitive-area coverage, generic risk detection
  - Weighted average → 0–100 overall score + level (poor/fair/good/excellent)
- `src/healthScore.test.ts` — 17 unit tests covering each dimension and edge cases
- `public/index.html` — collapsible "Pack Health" section in detail view:
  - Score badge showing level (poor/fair/good/excellent) with color coding
  - Per-dimension score bars with actionable improvement suggestions
  - Collapses by default; header click toggles
  - Re-renders when goal is saved

### B-HISTORY-UI — Version history tab in detail view ✅
- `public/index.html` — "Version History" section below drift analysis:
  - Loads `GET /api/intent-packs/:id/history` on pack select and after edits
  - Displays newest-first timeline of snapshots
  - Each entry shows a field-by-field diff (before/after) for: goal, objective, context, notes, status, tags
  - Shows "No history yet" for fresh packs
  - Auto-reloads after goal/notes saves (which create history snapshots)
- `tests/browser/history.spec.ts` — 3 browser tests: section visible, no-history message, entries after edit
- `playwright.config.ts` — added `workers: 1` to prevent flaky parallel timeouts in this sandbox environment (25 tests with 2 workers caused intermittent 30s timeouts)

## What was verified
- `npm run build` → passes (tsc, 0 errors)
- `node --test dist/**/*.test.js` → 220/220 unit + integration tests pass (was 183 before this slice; +37 tests)
- `npx playwright test` → 25/25 browser tests pass (was 19 before this slice; +6 tests)
- All existing pack behaviors preserved (backward compat: new UI sections have no server-side changes)

## What was completed (continued)

### B-LLM-1 — LLM provider abstraction layer ✅
- New `src/core/llmProvider.ts`:
  - `LlmProvider` interface: `generate(input: IntentPackInput): Promise<IntentPack>`
  - `HeuristicProvider` — wraps `generateIntentPack()`, returns `reasoningMode: "heuristic"` (no network I/O)
  - `StubLlmProvider` — deterministic credential-free stub, returns `reasoningMode: "llm"` for integration boundary testing
  - `createProvider(config)` factory with exhaustiveness check; `LlmProviderConfig` union ready for future real-model entries
- `src/core/handler.ts`:
  - `createHandler()` accepts optional 4th param `provider?: LlmProvider`, defaults to `HeuristicProvider`
  - Both `/api/intent-pack` and `/api/intent-pack/export-issue` routes use the provider
  - Removed direct `generateIntentPack` import from handler (now only via provider)
- `src/llmProvider.test.ts` — 16 unit tests for all providers and factory
- `src/server.test.ts` — 4 integration tests: stub provider injection, pack persistence via stub, export-issue with stub, default falls back to heuristic

## What was verified
- `npm run build` → passes (tsc, 0 errors)
- `node --test dist/**/*.test.js` → 240/240 unit + integration tests pass (was 220 before B-LLM-1; +20 tests)
- `npx playwright test` → 25/25 browser tests pass (unchanged)
- All existing pack behaviors preserved (backward compat: default provider is HeuristicProvider, existing behavior identical)

## Where work stopped
Clean boundary. B-LLM-1 is complete.

## Next recommended slice

### Priority 1 — B-GH-LIVE: Live GitHub issue creation
- Accept a GitHub PAT in local config
- Wire up `POST /repos/:owner/:repo/issues` via GitHub API
- Save returned issue URL on the pack
- **Blocked on**: GitHub PAT or GitHub App credentials (external)

No further unblocked slices remain in the backlog. All non-blocked items are done.
