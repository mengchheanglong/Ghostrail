# Design Document — UX/UI Redesign

## Overview

This document describes the component-level design for the Ghostrail UX/UI redesign. The scope is
purely frontend: no API contracts, server routes, or data schemas change. Every modification is
additive or a label/copy swap inside existing components, plus two new components
(`OnboardingBanner`, `Tooltip`).

The guiding principle is **progressive disclosure**: first-time users see a welcoming, jargon-free
surface; returning users see the same efficient interface they already know, with richer context
available on demand via tooltips and expandable sections.

---

## Architecture

The app is a single-page React + TypeScript application built with Vite. State lives in `App.tsx`
via `useState`; there is no global store. Framer Motion handles all animated transitions.
CSS design tokens in `index.css` drive the visual theme.

```
App.tsx
├── <header>                    ← branding, tagline, help link
├── OnboardingBanner            ← NEW — first-visit guide (localStorage-gated)
├── GeneratorForm               ← primary focal point; quality bar, clarifying questions
├── section separator           ← 32px gap + <hr> divider
├── "Your Saved Packs" heading  ← plain-language section label
└── .layout
    ├── Sidebar                 ← filter pills, search, pack list
    └── main
        └── Detail Card
            ├── ActionButtons   ← two-tier action bar, overflow menu
            ├── metadata row    ← truncated ID + Tooltip, relative time
            ├── Confidence/Reasoning badges + Tooltip (NEW wrapper)
            ├── StatusDropdown
            ├── DetailTabs      ← renamed tabs
            └── tab content
                ├── design tab  ← policy warnings (with "What is this?"), editable fields
                ├── health tab  ← PackHealthScore, DriftAnalysis, VersionHistory
                └── publish tab ← GithubIssue
```

The two new components are thin wrappers with no side effects:

- `OnboardingBanner` — reads/writes a single `localStorage` key (`ghostrail.onboarding.dismissed`).
- `Tooltip` — a CSS-positioned overlay rendered via a React portal; no external dependencies.

---

## Components and Interfaces

### OnboardingBanner

```tsx
interface OnboardingBannerProps {
  /** Called when the banner is dismissed (button click or first pack created). */
  onDismiss: () => void;
}
```

**Visibility logic** (owned by `App.tsx`):

```ts
const DISMISSED_KEY = 'ghostrail.onboarding.dismissed';

function shouldShowBanner(packs: IntentPack[]): boolean {
  return (
    localStorage.getItem(DISMISSED_KEY) !== 'true' &&
    packs.length === 0
  );
}
```

`App.tsx` passes `showBanner` as a derived boolean and calls `handleDismissBanner` which sets the
key and flips local state. When `onPackCreated` fires, `App.tsx` also calls `handleDismissBanner`
so the banner auto-hides after the first generation.

**Rendered content:**
- One-sentence plain-language description of Ghostrail.
- Numbered three-step guide (1 → 2 → 3).
- "Got it, hide this" dismiss button (`btn btn-ghost`).
- Framer Motion `AnimatePresence` fade-out on dismiss.

---

### Tooltip

```tsx
interface TooltipProps {
  content: string;          // plain-language explanation
  children: React.ReactNode;
  position?: 'top' | 'bottom'; // default: 'top'
}
```

Renders `children` inside a `<span>` with `tabIndex={0}` (if the child is not already focusable).
On `mouseenter`/`focus`, shows a small overlay via `position: absolute` inside a wrapping
`position: relative` container. No portal needed given the z-index context.

Keyboard accessible: `role="tooltip"` on the overlay, `aria-describedby` linking child to tooltip.

---

### GeneratorForm (modified)

Changes from current:

| Current | New |
|---|---|
| Section title: "Generate Intent Pack" | Section title: "Generate a Pack" |
| No visible textarea label | `<label htmlFor="goal">What do you want to build or change?</label>` |
| Button: "⚡ Generate Intent Pack" | Button: "⚡ Generate Pack" |
| Clarifying section title: "A few quick questions" | Step label: "Step 2 of 2 — Answer a few questions" |
| No question count | Progress indicator: "3 questions" |
| Goal/context opacity 0.6 in clarifying stage | Explicit `readOnly` + dimmed wrapper with `pointer-events: none` |
| Loading text: "Generating…" / "Loading…" | "Generating your pack…" in clarifying stage |
| Quality label: raw level name | "Needs more detail" / "Getting there" / "Looks good" |
| No confirmation on clear quality | Positive message when level === 'clear' |
| Error: plain string | Error: string + "Try again" button + dismiss ✕ |

Quality label mapping (pure function, no state):

```ts
const QUALITY_LABELS: Record<GoalQualityResult['level'], string> = {
  vague:   'Needs more detail',
  partial: 'Getting there',
  clear:   'Looks good',
};

const QUALITY_CONFIRMATION = "Your goal is specific enough to generate a high-quality pack.";
```

---

### ActionButtons (modified)

Two-tier layout:

**Tier 1 (always visible, top-level):** Export dropdown, Re-run  
**Tier 2 (overflow menu "More ▾"):** Duplicate, Star/Unstar, Archive/Unarchive, Delete

The overflow menu reuses the same dropdown pattern already used for Export (absolute-positioned
panel, click-outside close, `AnimatePresence`).

Delete remains inside the overflow menu and retains the existing two-step confirmation pattern
(first click → "Confirm delete?", second click → execute). The "Cancel" button appears inline.

Desktop (≥ 900px): Export + Re-run visible; "More ▾" button for the rest.  
Mobile (< 900px): Export + "More ▾" only (Re-run moves into overflow).

```tsx
interface ActionButtonsProps {
  pack: IntentPack;
  onUpdate: (updated: IntentPack) => void;
  onDelete: () => void;
  onRerun?: () => void;
  onDuplicate?: (newPack: IntentPack) => void;
}
// Props unchanged — internal layout only changes.
```

---

### DetailTabs (modified)

Tab ID values are unchanged (to avoid breaking `activeTab` state and existing browser tests).
Only the displayed labels and descriptions change:

| Tab ID | Old label | New label | New desc |
|---|---|---|---|
| `design` | Design | Design | Goal · Constraints · Criteria |
| `audit` | Audit | Health & History | Health · Drift · History |
| `sync` | Sync | Publish | GitHub Issues |

---

### Sidebar (modified)

Filter pill label mapping:

| Old label | New label | Filter ID |
|---|---|---|
| All | All | `all` |
| ⭐ Starred | Starred | `starred` |
| ⚠ Flagged | Has Warnings | `flagged` |
| ✓ Ready | Ready to Use | `ready` |
| ▶ Active | In Progress | `in-progress` |

Empty state additions:
- When `search` is non-empty and `filtered.length === 0`: show "No packs match your search" + `<button onClick={() => setSearch('')}>Clear search</button>`.
- When `activeFilter !== 'all'` and `filtered.length === 0`: show "No packs in this group" + `<button onClick={() => setActiveFilter('all')}>Show all packs</button>`.
- Error state: existing `alert-error` div gains a `<button className="btn btn-ghost">Retry</button>` that calls a new `onRetry` prop.

New prop added to `Sidebar`:

```tsx
onRetry: () => void;  // re-triggers loadPacks in App.tsx
```

---

### App.tsx (modified)

Key changes:

1. **Header tagline**: `"Intent Pack Generator"` → `"AI Guardrails for Coding Work"`.
2. **Logo icon**: `⚡` → `🛡` (shield, consistent with guardrail theme).
3. **Help link**: `<a href="#" aria-label="Help">?</a>` icon button in header (links to README or in-app guide).
4. **Page title removed**: The `<h1 className="page-title">Your Intent Packs</h1>` is removed. The Generator_Form card heading serves as the primary entry point.
5. **Section separator**: A `<div className="section-separator">` with `margin: 32px 0 16px` and a `<hr>` styled with `var(--border)` is inserted between `GeneratorForm` and the `.layout` div.
6. **Section label**: `<p className="section-label">Your Saved Packs</p>` above `.layout`.
7. **OnboardingBanner**: Rendered above `GeneratorForm`, gated by `showBanner` state.
8. **Confidence/Reasoning badges**: Wrapped in `<Tooltip content={...}>` in the design tab.
9. **UUID display**: Replace raw `{selectedPack.id}` with truncated form + Tooltip.
10. **Policy warning block**: Add plain-language intro sentence and "What is this?" `<details>` element.
11. **Acknowledge confirmation**: After `handleAcknowledge`, set a `acknowledgeMsg` state string that auto-clears after 3 seconds via `setTimeout`.
12. **Policy error placement**: Move `policyError` span to render directly below `<StatusDropdown>`.

Truncated ID helper (pure function):

```ts
function truncateId(id: string): string {
  return `Pack #${id.slice(0, 6).toUpperCase()}`;
}
```

---

### index.css (additions only)

New utility classes appended to the existing file:

```css
/* Section separator between Generator and saved-packs layout */
.section-separator {
  margin: 32px 0 16px;
  border: none;
  border-top: 1px solid var(--border);
}

/* Plain-language section label above the sidebar+main layout */
.section-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin: 0 0 12px;
}

/* Tooltip wrapper */
.tooltip-root {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.tooltip-overlay {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e2433;
  border: 1px solid var(--border-hover);
  border-radius: var(--r-md);
  padding: 7px 11px;
  font-size: 0.75rem;
  color: var(--text);
  line-height: 1.5;
  white-space: nowrap;
  max-width: 260px;
  white-space: normal;
  z-index: 200;
  pointer-events: none;
  box-shadow: var(--shadow-md);
}

/* Onboarding banner */
.onboarding-banner {
  background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: var(--r-xl);
  padding: 20px 24px;
  margin-bottom: 20px;
}

/* Clarifying questions step panel */
.clarifying-panel {
  background: rgba(99,102,241,0.06);
  border: 1px solid rgba(99,102,241,0.18);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  margin-top: 16px;
}

/* Overflow action menu */
.action-overflow-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  background: var(--bg-card);
  border: 1px solid var(--border-hover);
  border-radius: var(--r-md);
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-md);
}
```

---

## Data Models

No new data types are introduced. The existing `IntentPack` interface in `frontend/src/types.ts`
is unchanged.

New UI-only state in `App.tsx`:

```ts
const [showBanner, setShowBanner]         = useState<boolean>(() =>
  localStorage.getItem('ghostrail.onboarding.dismissed') !== 'true'
);
const [acknowledgeMsg, setAcknowledgeMsg] = useState('');
```

New UI-only state in `GeneratorForm.tsx` (no interface change):

```ts
// quality label mapping is a pure derived value, no new state needed
```

New UI-only state in `Sidebar.tsx` (no interface change):

```ts
// onRetry prop added; no new internal state
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Onboarding banner localStorage round-trip

*For any* dismissed state persisted in `localStorage` under the key
`ghostrail.onboarding.dismissed`, re-mounting the `App` component should result in the
`OnboardingBanner` not being rendered.

**Validates: Requirements 1.4, 1.5**

---

### Property 2: No "Intent Pack" jargon in rendered UI

*For any* rendered output of the application (excluding exported file names and the product name
"Ghostrail"), the string "Intent Pack" should not appear as visible user-facing text.

**Validates: Requirements 3.1**

---

### Property 3: Confidence badge uses human-readable label

*For any* `IntentPack` with a `confidence` value of `"high"`, `"medium"`, or `"low"`, the rendered
`Confidence_Badge` text should be one of `"High confidence"`, `"Medium confidence"`, or
`"Low confidence"` — never the raw value prefixed with `"confidence: "`.

**Validates: Requirements 4.3**

---

### Property 4: Reasoning badge uses human-readable label

*For any* `IntentPack` with a `reasoningMode` value of `"heuristic"`, `"llm"`, or `"stub"`, the
rendered `Reasoning_Badge` text should be a human-readable label (`"Rule-based"`, `"AI-powered"`,
`"Preview mode"`) — never the raw internal value alone.

**Validates: Requirements 4.4**

---

### Property 5: UUID is never displayed as raw visible text

*For any* `IntentPack` with a UUID `id`, the rendered detail card should not contain the full UUID
string as visible text; it should contain only a truncated identifier (e.g. `"Pack #58C499"`).

**Validates: Requirements 4.5**

---

### Property 6: Action bar top-level button count ≤ 4

*For any* `IntentPack` state (starred, archived, with/without policy warnings), the number of
top-level buttons rendered in the `ActionButtons` component at desktop viewport width should be
no more than 4.

**Validates: Requirements 5.4**

---

### Property 7: Delete requires two-step confirmation

*For any* pack, clicking the Delete button once should change its label to `"Confirm delete?"` and
should not invoke `onDelete`; only a second click should invoke `onDelete`.

**Validates: Requirements 5.3**

---

### Property 8: Error messages are plain-language strings without stack traces

*For any* error thrown during pack generation or pack loading, the displayed error message should
be a non-empty plain string that does not contain JavaScript stack trace markers (e.g. `"at "`,
`"Error:"` followed by a file path, or `"\n    at"`).

**Validates: Requirements 6.1, 6.5**

---

### Property 9: Quality bar label matches quality level

*For any* goal string, the rendered quality bar label should be exactly `"Needs more detail"` when
`level === "vague"`, `"Getting there"` when `level === "partial"`, and `"Looks good"` when
`level === "clear"`. When `level === "clear"`, the positive confirmation message should also be
present. When `level` is `"vague"` or `"partial"`, at least one suggestion should be rendered.

**Validates: Requirements 9.1, 9.2, 9.4**

---

### Property 10: Icon-only buttons have accessible labels

*For any* button rendered in the application that has no visible text content (icon-only), the
button element should have a non-empty `aria-label` attribute so that screen reader users can
identify its purpose.

**Validates: Requirements 10.5**

---

### Property 11: Clarifying questions panel shows correct question count

*For any* list of clarifying questions of length N (where N > 0), the rendered
`Clarifying_Questions_Panel` should display a progress indicator containing the number N.

**Validates: Requirements 11.2**

---

## Error Handling

### Generation errors (`GeneratorForm`)

Current: a plain string in an `alert-error` div.  
New: the error div gains a "Try again" button (`onClick={() => { setError(''); handleGenerate(); }}`)
and a dismiss `✕` button (`onClick={() => setError('')}`). The error message is always a
plain-language string — the `catch` block maps `err.message` and strips any stack trace content.

```ts
function toUserMessage(err: unknown): string {
  if (err instanceof Error) {
    // Strip stack trace lines
    return err.message.split('\n')[0] || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
```

### Load errors (`Sidebar`)

The existing `alert-error` div gains a `<button className="btn btn-ghost" onClick={onRetry}>Retry</button>`.
`App.tsx` passes `loadPacks` as `onRetry`.

### GitHub Issue errors (`GithubIssue`)

The component already surfaces errors. The new requirement is to include the specific reason from
the API response and a link to `https://github.com/settings/tokens`. This is a localised change
inside `GithubIssue.tsx` (not in scope for this design document's component interfaces, but noted
for implementation).

### Policy blocking error

Moved from a floating `<span>` to a block element rendered immediately after `<StatusDropdown>`,
so it is visually adjacent and semantically associated.

---

## Testing Strategy

### Dual approach

Both unit tests and property-based tests are required. They are complementary:

- **Unit / example tests** verify specific rendered states, label strings, DOM structure, and
  user interaction flows.
- **Property-based tests** verify universal invariants across all valid inputs, catching edge
  cases that example tests miss.

### Unit tests (Vitest + React Testing Library)

Focus areas:
- `OnboardingBanner` renders in first-visit state and is absent after dismiss.
- `Tooltip` shows/hides on focus/blur and contains the correct `role="tooltip"`.
- `DetailTabs` renders "Health & History" and "Publish" labels.
- `Sidebar` filter pill labels match the new plain-language strings.
- `GeneratorForm` textarea has the correct `<label>` text.
- `ActionButtons` Delete button is not visible at top level; appears in overflow menu.
- Policy warning block contains the "What is this?" `<details>` element.
- Acknowledge confirmation message appears and disappears after 3 seconds.

### Property-based tests (fast-check, minimum 100 runs each)

Each property test maps directly to a Correctness Property above.

| Test | Property | Tag |
|---|---|---|
| Banner hidden when localStorage key set | Property 1 | `Feature: ux-ui-redesign, Property 1` |
| No "Intent Pack" in rendered text | Property 2 | `Feature: ux-ui-redesign, Property 2` |
| Confidence badge label | Property 3 | `Feature: ux-ui-redesign, Property 3` |
| Reasoning badge label | Property 4 | `Feature: ux-ui-redesign, Property 4` |
| UUID not in visible text | Property 5 | `Feature: ux-ui-redesign, Property 5` |
| ≤ 4 top-level action buttons | Property 6 | `Feature: ux-ui-redesign, Property 6` |
| Two-step delete confirmation | Property 7 | `Feature: ux-ui-redesign, Property 7` |
| Error messages are plain strings | Property 8 | `Feature: ux-ui-redesign, Property 8` |
| Quality bar label correctness | Property 9 | `Feature: ux-ui-redesign, Property 9` |
| Icon-only buttons have aria-label | Property 10 | `Feature: ux-ui-redesign, Property 10` |
| Clarifying questions count indicator | Property 11 | `Feature: ux-ui-redesign, Property 11` |

**Configuration**: each `fc.assert(fc.property(...))` call uses `{ numRuns: 100 }` as the minimum.
Tests live in `frontend/src/components/__tests__/` alongside the components they test.

### Existing browser tests

The Playwright suite in `tests/browser/` must continue to pass. Tab IDs (`tab-audit`, `tab-sync`)
are preserved so existing selectors remain valid. Button IDs (`exportBtn`, `deleteBtn`, etc.) are
preserved. The only breaking change risk is the removal of the `"Your Intent Packs"` `<h1>` — any
test asserting that text will need updating during implementation.
