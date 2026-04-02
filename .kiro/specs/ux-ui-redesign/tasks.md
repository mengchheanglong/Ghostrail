# Implementation Plan: UX/UI Redesign

## Overview

Frontend-only changes. No backend or API modifications. Tasks are ordered so CSS additions unblock
component work, new components come before the App.tsx changes that consume them, and tests come
last. Each task targets a single file or tightly-scoped concern.

## Tasks

- [x] 1. Add new CSS utility classes to index.css
  - Append `.section-separator`, `.section-label`, `.tooltip-root`, `.tooltip-overlay`,
    `.onboarding-banner`, `.clarifying-panel`, and `.action-overflow-menu` blocks to
    `frontend/src/index.css` exactly as specified in the design document.
  - No existing rules should be modified.
  - _Requirements: 2.2, 2.3, 2.4, 4.1, 1.1, 5.1_

- [x] 2. Create OnboardingBanner component
  - [x] 2.1 Implement `frontend/src/components/OnboardingBanner.tsx`
    - Accept `onDismiss: () => void` prop.
    - Render one-sentence plain-language description, numbered three-step guide, and
      "Got it, hide this" dismiss button (`btn btn-ghost`).
    - Wrap in Framer Motion `AnimatePresence` for fade-out on dismiss.
    - Apply `.onboarding-banner` CSS class.
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ]* 2.2 Write unit tests for OnboardingBanner
    - Test renders in first-visit state.
    - Test dismiss button calls `onDismiss`.
    - Test three-step guide items are present.
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 3. Create Tooltip component
  - [x] 3.1 Implement `frontend/src/components/Tooltip.tsx`
    - Accept `content: string`, `children: React.ReactNode`, `position?: 'top' | 'bottom'` props.
    - Render children inside a `<span>` with `tabIndex={0}` when child is not focusable.
    - Show overlay on `mouseenter`/`focus`, hide on `mouseleave`/`blur`.
    - Apply `.tooltip-root` and `.tooltip-overlay` CSS classes.
    - Set `role="tooltip"` on overlay and `aria-describedby` linking child to tooltip.
    - _Requirements: 4.1, 4.2, 10.5_

  - [ ]* 3.2 Write unit tests for Tooltip
    - Test overlay is hidden by default.
    - Test overlay appears on focus and contains `role="tooltip"`.
    - Test `aria-describedby` is set on the child wrapper.
    - _Requirements: 4.1, 4.2, 10.5_

- [x] 4. Update DetailTabs — rename Audit and Sync tabs
  - In `frontend/src/components/DetailTabs.tsx`, update the `TABS` array:
    - `audit` label: `"Audit"` → `"Health & History"`, desc unchanged.
    - `sync` label: `"Sync"` → `"Publish"`, desc unchanged.
  - Tab `id` values (`'audit'`, `'sync'`) must remain unchanged.
  - _Requirements: 3.5, 3.6_

  - [ ]* 4.1 Write unit test for DetailTabs label changes
    - Assert rendered output contains "Health & History" and "Publish".
    - Assert tab IDs `tab-audit` and `tab-sync` are still present in the DOM.
    - _Requirements: 3.5, 3.6_

- [x] 5. Update Sidebar — filter pill labels and empty-state recovery buttons
  - In `frontend/src/components/Sidebar.tsx`:
    - Update `FILTER_DEFS` labels: `"⭐ Starred"` → `"Starred"`, `"⚠ Flagged"` → `"Has Warnings"`,
      `"✓ Ready"` → `"Ready to Use"`, `"▶ Active"` → `"In Progress"`.
    - Add `onRetry: () => void` prop; attach to a `<button className="btn btn-ghost">Retry</button>`
      rendered inside the existing `alert-error` div.
    - When `search` is non-empty and `filtered.length === 0`: add
      `<button onClick={() => setSearch('')}>Clear search</button>` below the empty-state message.
    - When `activeFilter !== 'all'` and `filtered.length === 0`: add
      `<button onClick={() => setActiveFilter('all')}>Show all packs</button>` below the message.
  - _Requirements: 3.7, 6.2, 7.3, 7.4_

  - [ ]* 5.1 Write unit tests for Sidebar changes
    - Test new filter pill labels render correctly.
    - Test "Clear search" button appears when search has no results.
    - Test "Show all packs" button appears when filter has no results.
    - Test Retry button renders when `error` is non-empty.
    - _Requirements: 3.7, 6.2, 7.3, 7.4_

- [x] 6. Update GeneratorForm — labels, quality bar, clarifying panel, error handling
  - In `frontend/src/components/GeneratorForm.tsx`:
    - Change section title from `"Generate Intent Pack"` to `"Generate a Pack"`.
    - Add `<label htmlFor="goal">What do you want to build or change?</label>` above the goal textarea.
    - Change generate button label from `"⚡ Generate Intent Pack"` to `"⚡ Generate Pack"`.
    - Add `QUALITY_LABELS` mapping (`vague` → `"Needs more detail"`, `partial` → `"Getting there"`,
      `clear` → `"Looks good"`) and use it for the `#qualityLabel` badge text.
    - When `quality.level === 'clear'`, render the confirmation message
      `"Your goal is specific enough to generate a high-quality pack."` below the quality bar.
    - Wrap the clarifying questions block in a `<div className="clarifying-panel">`.
    - Change clarifying section title to `"Step 2 of 2 — Answer a few questions"`.
    - Add a progress indicator showing question count (e.g. `"3 questions"`) below the title.
    - Dim goal/context textareas in clarifying stage with `pointer-events: none` on a wrapper div.
    - Change loading text in clarifying stage to `"Generating your pack…"`.
    - Add `toUserMessage(err)` helper that strips stack trace lines from error messages.
    - Add "Try again" button and dismiss `✕` button to the error alert.
    - _Requirements: 2.4, 3.2, 3.3, 6.1, 6.5, 9.1, 9.2, 9.4, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 6.1 Write unit tests for GeneratorForm changes
    - Test `<label>` text is "What do you want to build or change?".
    - Test generate button label is "Generate Pack".
    - Test quality label shows "Needs more detail" for vague input.
    - Test quality label shows "Looks good" for clear input.
    - Test confirmation message appears when quality is clear.
    - Test clarifying panel shows question count.
    - Test error alert renders "Try again" and dismiss buttons.
    - _Requirements: 3.2, 3.3, 6.1, 9.1, 9.4, 11.2_

- [x] 7. Update ActionButtons — two-tier layout with overflow menu
  - In `frontend/src/components/ActionButtons.tsx`:
    - Keep Export dropdown and Re-run as Tier 1 (always visible).
    - Move Duplicate, Star/Unstar, Archive/Unarchive, and Delete into a "More ▾" overflow menu
      using the `.action-overflow-menu` CSS class and the same click-outside close pattern as
      the existing export dropdown.
    - The overflow menu button should have `id="moreActionsBtn"`.
    - Delete retains its two-step confirmation pattern inside the overflow menu.
    - On mobile (< 900px via a `window.innerWidth` check or CSS media query), Re-run also moves
      into the overflow menu.
    - Preserve all existing button `id` attributes (`deleteBtn`, `starBtn`, `archiveBtn`,
      `duplicateBtn`, `rerunBtn`).
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.1 Write unit tests for ActionButtons changes
    - Test Delete button is not visible at top level (inside overflow menu).
    - Test clicking "More ▾" reveals Delete, Star, Archive, Duplicate.
    - Test Delete first click shows "Confirm delete?" without calling `onDelete`.
    - Test Delete second click calls `onDelete`.
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 8. Update App.tsx — header, banner, section structure, metadata, policy warnings
  - In `frontend/src/App.tsx`:
    - Change logo icon from `⚡` to `🛡`.
    - Change tagline from `"Intent Pack Generator"` to `"AI Guardrails for Coding Work"`.
    - Add a help icon button `<a href="#" aria-label="Help">?</a>` in the header.
    - Remove `<h1 className="page-title">Your Intent Packs</h1>` and `<p className="page-subtitle">`.
    - Add `showBanner` state initialised from `localStorage.getItem('ghostrail.onboarding.dismissed') !== 'true'`.
    - Add `handleDismissBanner` that sets the localStorage key and flips `showBanner` to false.
    - Call `handleDismissBanner` inside `onPackCreated` so the banner auto-hides after first generation.
    - Render `<OnboardingBanner onDismiss={handleDismissBanner} />` above `<GeneratorForm>`, gated by `showBanner && packs.length === 0`.
    - Insert `<hr className="section-separator" />` and `<p className="section-label">Your Saved Packs</p>` between `<GeneratorForm>` and `.layout`.
    - Pass `onRetry={loadPacks}` to `<Sidebar>`.
    - Add `acknowledgeMsg` state; set it to `"Warnings acknowledged — you can now approve this pack"` in `handleAcknowledge` and clear it after 3 seconds via `setTimeout`.
    - Render `acknowledgeMsg` as a success alert below the acknowledge button when non-empty.
    - Replace raw `{selectedPack.id}` with `truncateId(selectedPack.id)` and wrap in `<Tooltip content={selectedPack.id}>`.
    - Add `truncateId` pure function: `` `Pack #${id.slice(0, 6).toUpperCase()}` ``.
    - Wrap confidence badge in `<Tooltip content="...plain-language explanation...">`.
    - Wrap reasoning badge in `<Tooltip content="...plain-language explanation...">`.
    - Update confidence badge text to human-readable form (e.g. `"High confidence"`).
    - Update reasoning badge text to human-readable form (e.g. `"Rule-based"`, `"AI-powered"`, `"Preview mode"`).
    - Add plain-language intro sentence and `<details><summary>What is this?</summary>...</details>` to the policy warnings block.
    - Move `policyError` span to render directly below `<StatusDropdown>` (it already does — verify placement is correct).
    - Import `OnboardingBanner` and `Tooltip` components.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.2, 2.3, 2.5, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5, 6.2, 8.1, 8.3, 8.4, 12.1, 12.3, 12.4_

  - [ ]* 8.1 Write unit tests for App.tsx changes
    - Test OnboardingBanner renders when localStorage key is absent and packs are empty.
    - Test OnboardingBanner is absent when localStorage key is `'true'`.
    - Test section separator and "Your Saved Packs" label are present.
    - Test truncated ID renders as "Pack #XXXXXX" format.
    - Test acknowledge confirmation message appears after clicking acknowledge.
    - Test policy warning block contains a `<details>` element.
    - _Requirements: 1.1, 1.4, 1.5, 2.2, 2.3, 4.5, 8.1, 8.3, 8.4_

- [x] 9. Checkpoint — verify all unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 10. Write property-based tests (fast-check)
  - [ ] 10.1 Write property test for Property 1 — onboarding banner localStorage round-trip
    - For any dismissed state in localStorage, re-mounting should not render OnboardingBanner.
    - **Property 1: Onboarding banner localStorage round-trip**
    - **Validates: Requirements 1.4, 1.5**

  - [ ] 10.2 Write property test for Property 2 — no "Intent Pack" jargon in rendered UI
    - For any rendered output, the string "Intent Pack" should not appear as visible user-facing text.
    - **Property 2: No "Intent Pack" jargon in rendered UI**
    - **Validates: Requirements 3.1**

  - [ ] 10.3 Write property test for Property 3 — confidence badge uses human-readable label
    - For any `confidence` value of `"high"`, `"medium"`, or `"low"`, the badge text should be
      `"High confidence"`, `"Medium confidence"`, or `"Low confidence"`.
    - **Property 3: Confidence badge uses human-readable label**
    - **Validates: Requirements 4.3**

  - [ ] 10.4 Write property test for Property 4 — reasoning badge uses human-readable label
    - For any `reasoningMode` value, the badge text should be `"Rule-based"`, `"AI-powered"`, or
      `"Preview mode"` — never the raw internal value alone.
    - **Property 4: Reasoning badge uses human-readable label**
    - **Validates: Requirements 4.4**

  - [ ] 10.5 Write property test for Property 5 — UUID is never displayed as raw visible text
    - For any pack UUID, the detail card should not contain the full UUID as visible text.
    - **Property 5: UUID is never displayed as raw visible text**
    - **Validates: Requirements 4.5**

  - [ ] 10.6 Write property test for Property 6 — action bar top-level button count ≤ 4
    - For any pack state, the number of top-level buttons in ActionButtons at desktop width ≤ 4.
    - **Property 6: Action bar top-level button count ≤ 4**
    - **Validates: Requirements 5.4**

  - [ ] 10.7 Write property test for Property 7 — delete requires two-step confirmation
    - For any pack, first click changes label to "Confirm delete?" without invoking `onDelete`;
      second click invokes `onDelete`.
    - **Property 7: Delete requires two-step confirmation**
    - **Validates: Requirements 5.3**

  - [ ] 10.8 Write property test for Property 8 — error messages are plain-language strings
    - For any error thrown during generation, the displayed message should not contain stack trace
      markers (`"at "`, file paths, `"\n    at"`).
    - **Property 8: Error messages are plain-language strings without stack traces**
    - **Validates: Requirements 6.1, 6.5**

  - [ ] 10.9 Write property test for Property 9 — quality bar label matches quality level
    - For any goal string, the quality label should be exactly `"Needs more detail"`, `"Getting there"`,
      or `"Looks good"` matching the level. When clear, confirmation message is present.
    - **Property 9: Quality bar label matches quality level**
    - **Validates: Requirements 9.1, 9.2, 9.4**

  - [ ] 10.10 Write property test for Property 10 — icon-only buttons have accessible labels
    - For any button with no visible text content, the element should have a non-empty `aria-label`.
    - **Property 10: Icon-only buttons have accessible labels**
    - **Validates: Requirements 10.5**

  - [ ] 10.11 Write property test for Property 11 — clarifying questions panel shows correct count
    - For any list of N clarifying questions (N > 0), the panel should display a progress indicator
      containing the number N.
    - **Property 11: Clarifying questions panel shows correct question count**
    - **Validates: Requirements 11.2**

- [x] 11. Update Playwright browser tests for label changes
  - In `tests/browser/quality.spec.ts`:
    - Update assertion `toContainText("Vague")` → `toContainText("Needs more detail")`.
    - Update assertion `toContainText("Clear")` → `toContainText("Looks good")`.
  - Verify no other browser tests assert the removed `"Your Intent Packs"` heading or old tab
    labels (confirmed: none do; `#tab-audit` and `#tab-sync` IDs are preserved).
  - _Requirements: 9.1_

- [x] 12. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Tab IDs (`tab-audit`, `tab-sync`) and button IDs (`exportBtn`, `deleteBtn`, etc.) are preserved throughout to keep existing Playwright tests green
- Property tests live in `frontend/src/components/__tests__/` alongside unit tests
- Each property test uses `{ numRuns: 100 }` minimum as specified in the design
- The `onRetry` prop added to Sidebar requires a corresponding update to the App.tsx call site (covered in task 8)
