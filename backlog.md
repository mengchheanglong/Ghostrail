# backlog.md

## Rules
- Keep items small and concrete
- Prefer user-visible value or important safety/reliability value
- Items in "Ready" are the next bounded implementation candidates
- Only move an item to "Done" when fully verified

## Product roadmap (ordered)

Ghostrail is now a full **Intent Guardrail System**. The following 10 ideas form the ordered implementation roadmap. Items are tagged by category:
- **Foundation** — storage, model, or API layer that enables later features
- **Intelligence** — AI/model-backed quality improvement
- **Policy** — repo-wide safety and constraint enforcement
- **Verification** — compare intent vs reality
- **Workflow** — lifecycle, status, and collaboration

---

### Idea 1 — PR Diff vs. Intent Pack Drift Detection (Verification)
**Status**: ✅ Shipped (foundation + full engine).
**Why it matters**: The killer feature. Without this, Ghostrail is documentation. With it, Ghostrail can tell you when an agent went rogue or left work incomplete.
**Shipped**:
- `src/core/diffParser.ts` — `parseGitDiff()` extracts changed file paths from standard git diff text (modified, new, deleted, renamed, binary files; deduped, sorted)
- `POST /api/intent-packs/:id/analyze-diff` — accepts diff text, parses files, stores changedFiles on pack, returns `{ report, changedFiles }`
- `GET /api/intent-packs/:id/drift-report` — returns structured drift report with matchedFiles, scopeCreep, intentGap, status, summary
- UI: paste-diff textarea + "Analyze Drift" button in detail view; renders matched/unexpected/missing buckets with color-coded status badge
- 15 unit tests (diffParser), 7 integration tests (analyze-diff route), 4 browser tests (drift UI)
**Next step**: None for this slice. Future enhancement: deeper semantic matching beyond token-based path matching.

### Idea 2 — AI Agent Task Packet Generator (Foundation + Workflow)
**Status**: Shipped in this milestone.
**Why it matters**: Transforms every saved pack into a structured, copy-ready input for coding agents. Closes the loop between intent capture and agent execution.
**Shipped**:
- `src/core/taskPacket.ts` with `toTaskPacketJson()` and `toAgentPrompt()`
- `GET /api/intent-packs/:id/task-packet` returns JSON packet and agent prompt
- "Copy as Task Packet" button in detail view

### Idea 3 — LLM Integration with Pre-Generation Clarifying Questions (Intelligence)
**Status**: ✅ OpenAI provider shipped. Set `OPENAI_API_KEY` to activate.
**Why it matters**: The existing heuristic generator produces generic outputs. A real LLM call produces sharper packs.
**Shipped**:
- `src/core/llmProvider.ts` — `LlmProvider` interface, `HeuristicProvider`, `StubLlmProvider`, `OpenAiProvider`, `createProvider()` factory
- `OpenAiProvider`: structured JSON prompt, all fields validated, `confidence` defaults to `"medium"`, injectable fetch for testing
- `src/server.ts` auto-selects `OpenAiProvider` when `OPENAI_API_KEY` is set
- `createHandler()` accepts optional `provider?` param — integration boundary is fully testable without credentials
- 30 unit tests (16 original + 14 OpenAI); 4 integration tests
**To activate**: Set `OPENAI_API_KEY` in your environment and restart the server.
**Future**: Pre-generation clarifying questions (accept answers in request body and feed back into generation context).

### Idea 4 — Repo-Level Constraint Policy Engine (Policy)
**Status**: Foundation shipped in this milestone.
**Why it matters**: Transforms Ghostrail from a per-pack tool into a repo-wide safety layer. Teams encode institutional knowledge ("always require billing team review") as policy rules.
**Foundation shipped**:
- `src/core/policy.ts` with `loadPolicy()` and `applyPolicy()`
- `ghostrail-policy.json` support: `protectedAreas` and `rules`
- Policy applied during generation; `policyWarnings` returned in pack response
**Next step** — B-POLICY-2: UI shows policy warnings prominently in detail view; required acknowledgement before status can advance to "Approved".
**Dependencies**: Foundation is complete.

### Idea 5 — Live Goal Quality Score (Intelligence)
**Status**: ✅ Shipped (B-QUALITY).
**Why it matters**: Intervening at input time is cheaper than post-hoc debugging. A real-time quality score trains users to write better goals before generation.
**Shipped**:
- `src/core/goalQualityScore.ts` — pure heuristic scorer (vagueness, scope creep, constraint/specificity signals, 0–100 score + level + suggestions)
- `public/index.html` — live color-coded quality bar below goal textarea (🔴 Vague → 🟡 Partial → 🟢 Clear) with actionable suggestions
- 20 unit tests; 3 browser tests

### Idea 6 — Protected Areas Registry (Policy)
**Status**: Foundation shipped in this milestone (via ghostrail-policy.json).
**Why it matters**: Makes implicit institutional knowledge ("don't touch billing lightly") structural and automatically enforced.
**Foundation shipped**:
- `ghostrail-policy.json` accepts `protectedAreas: string[]`
- When a pack's `touchedAreas` match a protected area, a warning is added to `policyWarnings`
**Next step** — B-POLICY-2 (same as Idea 4): UI shows a prominent ⚠️ Protected Zone badge on packs with policy warnings; acknowledgement required before "Approved".

### Idea 7 — Pack Status Lifecycle (Workflow)
**Status**: Shipped in this milestone.
**Why it matters**: Turns packs from saved documents into live workflow artifacts.
**Shipped**:
- `PackStatus` type: `"draft" | "approved" | "in-progress" | "done" | "blocked" | "abandoned"`
- `status?` field on `StoredIntentPack` (absent = treated as draft)
- PATCH validates status values
- UI: status selector in detail view, status badge in sidebar
- Filter by status in sidebar

### Idea 8 — Pack Health Score with Inline Improvement Suggestions (Intelligence)
**Status**: ✅ Shipped (B-HEALTH).
**Why it matters**: Makes pack quality measurable and improvable. Users get specific feedback on what makes a pack good.
**Shipped**:
- `src/core/healthScore.ts` — pure 4-dimension scorer (Objective Specificity, Acceptance Criteria, Constraint Completeness, Risk Coverage); 0–100 score + level + per-dimension suggestions
- `public/index.html` — collapsible "Pack Health" section in detail view with score badge and per-dimension bars
- 17 unit tests

### Idea 9 — One-Click GitHub Issue + PR Description Creation (Workflow)
**Status**: ✅ Fully shipped (PR description + live GitHub issue creation).
**Why it matters**: Removes copy-paste friction. Every extra step is friction that causes the guardrail to be skipped.
**Shipped**:
- `src/core/prDescription.ts` with `toPrDescription()`
- `GET /api/intent-packs/:id/pr-description` returns PR description markdown; "Copy as PR Description" button in detail view
- `src/core/githubClient.ts` — `createGitHubIssue(owner, repo, title, body, token, fetchFn?)`
- `POST /api/intent-packs/:id/create-github-issue` — validates owner/repo/token, creates issue via GitHub API, saves `githubIssueUrl` on pack
- "Create GitHub Issue" section in detail view with owner/repo inputs, status messages, and issue link display
**To activate**: Set `GITHUB_TOKEN` env var, or pass `token` field in the request body.

### Idea 10 — Intent Version History with Visual Diff (Foundation + Workflow)
**Status**: ✅ Fully shipped (foundation + B-HISTORY-UI).
**Why it matters**: Intent changes are invisible in every existing system. Version-diffed packs give teams a record of how their thinking evolved.
**Shipped**:
- Foundation: `saveHistorySnapshot()` in `patchIntentPack`; `{id}.history.json` storage; `listPackHistory()`; `GET /api/intent-packs/:id/history`
- B-HISTORY-UI: "Version History" section in detail view — newest-first timeline of snapshots with field-by-field before/after diffs; auto-reloads after edits; 3 browser tests

---

### B-E2E — Comprehensive end-to-end pipeline tests
- Value: Prove the complete pipeline works from soup to nuts with no internal stubs, full field validation, and realistic test scenarios
- Scope: new `src/e2e.test.ts` (test-only, no production changes)
- Risk: low
- **Status**: ✅ Done (see B-E2E in Done section)

### B-BROWSER-WORKFLOW — Full browser workflow Playwright tests
- Value: Prove the integrated UI user experience works — from typing a goal into the generator form through every major feature in a single browser session
- Scope: new `tests/browser/workflow.spec.ts` (test-only, no production changes)
- Risk: low
- **Status**: ✅ Done (see B-BROWSER-WORKFLOW in Done section)


### B15 — Full drift engine
- Value: Complete the drift detection story. Accept a git diff (text or file list), run structured comparison against touchedAreas, return a scored drift report.
- Scope: `src/core/driftReport.ts` extension; no UI changes initially
- Risk: medium — diff parsing can be complex; start with file-list comparison only
- Verification: unit tests for drift comparison logic
- **Status**: ✅ Done (see B15 in Done section)

### B-POLICY-2 — Policy warning UI
- Value: Surface policy warnings prominently in the UI; add acknowledgement gate before "Approved"
- Scope: detail view only; no new storage
- Risk: low
- Verification: browser test for policy warning display
- **Status**: ✅ Done (see B-POLICY-2 in Done section)

### B-QUALITY — Live goal quality score
- Value: Real-time feedback as user types; trains better goal writing
- Scope: pure client-side; no server changes
- Risk: low
- Verification: unit tests for scoring logic; browser test for display
- **Status**: ✅ Done (see B-QUALITY in Done section)

### B-HEALTH — Pack health score (heuristic)
- Value: Per-pack quality measurement with specific improvement suggestions
- Scope: new `src/core/healthScore.ts`; detail view section
- Risk: low
- Verification: unit tests for scorer
- **Status**: ✅ Done (see B-HEALTH in Done section)

### B-HISTORY-UI — Version history tab in detail view
- Value: Surfaces the stored history with structured field diffs
- Scope: UI-only; history API already exists
- Risk: low
- Verification: browser test for history tab
- **Status**: ✅ Done (see B-HISTORY-UI in Done section)

### B-TABS-HEADER — Export/Sync dropdown in detail card header
- Value: Reduce action bar clutter — consolidate "Copy as Issue", "Copy Task Packet", "Copy PR Description" into a single "Export ▾" dropdown, following the Action Hub design recommendation
- Scope: `frontend/src/components/ActionButtons.tsx` only; no server changes
- Risk: low — all export buttons retain their IDs inside the dropdown; no test changes needed if IDs are preserved
- Verification: existing action button browser tests should still pass

## In progress
Move an item here only if a single active slice is currently being worked.

## Blocked
Move an item here if it needs user/product input.

(No items currently blocked — all items requiring external credentials have been implemented with env-var activation.)

## Done

### B-TABS — Three-mode tabbed detail view
- Completed: `frontend/src/components/DetailTabs.tsx` (Design / Audit / Sync tab bar); `frontend/src/App.tsx` restructured with Design=default (goal/policy/constraints), Audit (health/drift/history), Sync (GitHub issue). Archive deselection bug fixed. Browser tests updated. 296/296 unit tests + 29/29 browser tests pass.

### B-GH-LIVE — Live GitHub issue creation
- Completed: `src/core/githubClient.ts`; `POST /api/intent-packs/:id/create-github-issue` route; `githubIssueUrl` field on `StoredIntentPack`; "Create GitHub Issue" section in UI with owner/repo inputs and issue link display. Activate with `GITHUB_TOKEN` env var or per-request token. 269/269 unit tests + 25/25 browser tests pass.

### B-E2E — Comprehensive end-to-end pipeline tests
- Completed: `src/e2e.test.ts` — 27 end-to-end tests covering the complete Ghostrail pipeline (generation → list → get → patch → history → analyze-diff → drift-report → task-packet → pr-description → export-issue → create-github-issue → duplicate → delete). Full field validation on every response. Realistic GitHub API mock (full response body). 296/296 tests pass.

### B-BROWSER-WORKFLOW — Full browser workflow Playwright tests
- Completed: `tests/browser/workflow.spec.ts` — 4 browser tests driving the complete UI workflow from an empty store: (1) generate from scratch + all sections render, (2) full chain generate→edit→notes→tag→status→drift→history, (3) context shown in detail view, (4) search filters pack list. 29/29 browser tests pass.

### B-LLM-1 real model — OpenAI provider
- Completed: `OpenAiProvider` class with injectable fetch, structured JSON prompt, full validation; `OPENAI_API_KEY` auto-activates at server startup; 14 new unit tests. `createProvider({ type: "openai", apiKey })` factory case added. 269/269 tests pass.

### B-POLICY-2 — Policy warning UI acknowledgement
- Completed: `⚠` badge in sidebar; "Acknowledge Warnings" button in detail view; gate on "Approved" status; 3 browser tests. 183/183 unit tests + 19/19 browser tests pass.

### B-QUALITY — Live goal quality score
- Completed: `src/core/goalQualityScore.ts` (pure heuristic scorer); `src/goalQualityScore.test.ts` (20 unit tests); color-coded quality bar + inline suggestions in `public/index.html`; `tests/browser/quality.spec.ts` (3 browser tests). 220/220 unit tests + 25/25 browser tests pass.

### B-HEALTH — Pack health score (heuristic)
- Completed: `src/core/healthScore.ts` (4-dimension pure scorer); `src/healthScore.test.ts` (17 unit tests); collapsible "Pack Health" section in detail view. 220/220 unit tests + 25/25 browser tests pass.

### B-HISTORY-UI — Version history tab in detail view
- Completed: "Version History" section in detail view; loads `GET /api/intent-packs/:id/history`; field-by-field diff timeline; `tests/browser/history.spec.ts` (3 browser tests). 220/220 unit tests + 25/25 browser tests pass.

### B15 — Full drift engine
- Completed: `src/core/diffParser.ts` with `parseGitDiff()`; `POST /api/intent-packs/:id/analyze-diff`; drift UI (paste textarea + result buckets); 15 unit tests, 7 integration tests, 4 browser tests. 183/183 unit tests + 16/16 browser tests pass.

### Goal-shift milestone — Intent Guardrail System foundation
- Completed: Phase 0 (doctrine), Phase 1 (task packet), Phase 2 (status lifecycle), Phase 3 (PR description), Phase 4 (version history), Phase 5 (drift foundation), Phase 6 (policy/protected areas)
- All 10 ideas are translated into the ordered roadmap above

### B13 — Pack archiving / starring
- Completed: `starred?` and `archived?` fields; PATCH; UI toggles; sidebar indicators; 6 unit + 4 integration + 3 browser tests; 79/79 unit + 12/12 browser tests pass.

### B13-browser — Browser-flow tests for saved-pack action buttons
- Completed: `tests/browser/actions.spec.ts` — 5 tests; 9/9 browser tests pass.

### B12 — Browser-flow tests for inline editors
- Completed: Playwright installed; `tests/browser/editing.spec.ts` — 4 tests.

### B11 — Extend search/filter to match repositoryContext
- Completed: `getFilteredPacks()` extended; backward-compatible.

### B10 — Pack metadata editing (goal and repositoryContext)
- Completed: PATCH extended; inline editors; 12 new tests (69 total).

### B9 — Surface repositoryContext in GitHub Issue markdown export
- Completed: `toGitHubIssueMarkdown` includes repository context section; 5 new tests.

### B8 — Surface notes and tags in GitHub Issue markdown export
- Completed: Tags line and Notes section in export; 5 new tests.

### B7 — Pack organization and refinement milestone
- Completed: notes, tags, sidebar badges, duplicate pack; 21 new tests.

### B6 — Re-run from saved pack
- Completed: prefill generator from saved pack; draftHint.

### B5 — Export route integration coverage
- Completed: 3 integration tests for POST /api/intent-pack/export-issue.

### B4 — Responsive mobile layout
- Completed: flex stack on ≤640px screens.

### B3 — Delete saved pack
- Completed: DELETE endpoint + UI confirmation + tests.

### B2 — Search/filter saved packs
- Completed: client-side filter on goal, objective, and touchedAreas.

### B1 — Persist repositoryContext
- Completed: repositoryContext saved and surfaced in list, detail, and export views.
