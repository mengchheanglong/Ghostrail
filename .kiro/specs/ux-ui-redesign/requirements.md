# Requirements Document

## Introduction

Ghostrail is an Intent Guardrail System for AI coding work. Its current React + TypeScript frontend
is functionally complete but presents a steep learning curve for first-time users. The UX/UI
redesign aims to make every interaction feel obvious and intuitive — maximising clarity, minimising
jargon, and guiding users through the workflow without requiring prior knowledge of the product.

The redesign covers: page layout and visual hierarchy, navigation and labelling, microcopy and
onboarding, visual design tokens, error handling, and the treatment of technical metadata.
No backend changes are in scope.

---

## Glossary

- **App**: The Ghostrail React frontend application.
- **Generator_Form**: The card containing the goal textarea, quality bar, clarifying questions, and Generate button.
- **Sidebar**: The left-hand panel listing saved packs with search, filters, and archive toggle.
- **Detail_Card**: The right-hand panel showing the full content of the selected pack.
- **Pack**: A structured intent pack produced by the Generator_Form (previously called "Intent Pack").
- **Action_Bar**: The row of action buttons at the top of the Detail_Card (Export, Re-run, Duplicate, Star, Archive, Delete).
- **Tab_Bar**: The Design / Audit / Sync tab navigation inside the Detail_Card.
- **Quality_Bar**: The live goal-quality progress bar and suggestion list inside the Generator_Form.
- **Clarifying_Questions_Panel**: The inline section that appears when a goal is vague, asking follow-up questions before generation.
- **Onboarding_Banner**: A prominent, dismissible first-visit guide shown above the Generator_Form.
- **Empty_State**: The placeholder shown in the Detail_Card area when no pack is selected.
- **Policy_Warning**: An alert surfaced when a pack's goal touches protected repository areas.
- **Confidence_Badge**: A badge showing the generation confidence level (high / medium / low).
- **Reasoning_Badge**: A badge showing the generation mode (heuristic / llm / stub).
- **Status_Dropdown**: The control for setting a pack's lifecycle status (Draft → Approved → In Progress → Done).
- **Filter_Pills**: The row of clickable filter buttons in the Sidebar (All / Starred / Flagged / Ready / Active).
- **Tooltip**: A small overlay that appears on hover or focus to explain a UI element.
- **First_Visit**: The state of the App when no packs have been saved yet.
- **Returning_Visit**: The state of the App when at least one pack exists in the store.

---

## Requirements

### Requirement 1: Prominent Onboarding for First-Time Users

**User Story:** As a first-time user, I want to immediately understand what Ghostrail does and how
to start, so that I do not feel lost or confused when I open the app for the first time.

#### Acceptance Criteria

1. WHEN the App loads in First_Visit state, THE App SHALL display an Onboarding_Banner above the
   Generator_Form that explains Ghostrail's purpose in one sentence of plain language (no jargon).
2. THE Onboarding_Banner SHALL include a numbered three-step guide: (1) describe your feature,
   (2) generate a pack, (3) review and export.
3. WHEN the user generates their first Pack, THE App SHALL automatically dismiss the
   Onboarding_Banner.
4. THE Onboarding_Banner SHALL include a "Got it, hide this" dismiss button that persists the
   dismissed state in localStorage so the banner does not reappear on subsequent visits.
5. WHEN the App loads in Returning_Visit state, THE App SHALL NOT display the Onboarding_Banner
   unless the user explicitly resets it.

---

### Requirement 2: Clear Visual Hierarchy and Workflow Flow

**User Story:** As a new user, I want the page layout to guide me through the workflow in a logical
top-to-bottom order, so that I know where to start and what to do next without reading documentation.

#### Acceptance Criteria

1. THE App SHALL render the Generator_Form as the primary visual focal point at the top of the
   content area, above the Sidebar and Detail_Card layout.
2. THE App SHALL apply a visually distinct section separator (increased vertical spacing of at
   least 32px and a subtle divider line) between the Generator_Form and the saved-packs layout
   below it.
3. THE App SHALL label the saved-packs section with a plain-language heading ("Your Saved Packs")
   that is visually subordinate to the Generator_Form heading.
4. WHEN the Generator_Form is in the clarifying-questions stage, THE App SHALL visually separate
   the Clarifying_Questions_Panel from the goal textarea using a distinct background colour and a
   labelled section heading ("A few quick questions to sharpen your pack").
5. THE App SHALL NOT display the raw page title "Your Intent Packs" as the primary heading;
   instead THE App SHALL use the Generator_Form card heading as the primary entry point.

---

### Requirement 3: Plain-Language Labels and Microcopy

**User Story:** As a user unfamiliar with the term "Intent Pack", I want all labels, headings, and
button text to use plain language, so that I can understand what each element does without prior
knowledge of the product.

#### Acceptance Criteria

1. THE App SHALL replace every user-facing occurrence of the phrase "Intent Pack" with "Pack"
   or a plain-language equivalent (e.g. "your saved packs", "create a pack") except in the
   product name "Ghostrail" and in exported file names.
2. THE Generator_Form SHALL label its primary textarea with the plain-language prompt
   "What do you want to build or change?" instead of an unlabelled placeholder alone.
3. THE Generator_Form's generate button SHALL be labelled "Generate Pack" (removing the word
   "Intent") to reduce jargon.
4. THE Action_Bar's export button SHALL be labelled "Export" with a dropdown arrow, and each
   dropdown item SHALL use plain-language labels: "Copy as GitHub Issue", "Copy as Task Packet",
   "Copy as PR Description".
5. THE Tab_Bar SHALL rename the "Audit" tab to "Health & History" so the tab's purpose is
   self-evident without requiring prior knowledge.
6. THE Tab_Bar SHALL rename the "Sync" tab to "Publish" so the tab's purpose is self-evident.
7. THE Sidebar Filter_Pills SHALL use the following plain-language labels: "All", "Starred",
   "Has Warnings", "Ready to Use", "In Progress".
8. THE Status_Dropdown SHALL display status options with plain-language descriptions alongside
   each status name (e.g. "Draft — not yet reviewed", "Approved — ready to use").

---

### Requirement 4: Contextual Tooltips for Technical Metadata

**User Story:** As a non-technical user, I want to understand what the confidence and reasoning
mode badges mean, so that I can interpret the quality of a generated pack without guessing.

#### Acceptance Criteria

1. THE Confidence_Badge SHALL display a Tooltip on hover and keyboard focus that explains the
   confidence level in plain language (e.g. "High confidence means the goal was specific enough
   for Ghostrail to produce reliable constraints and criteria").
2. THE Reasoning_Badge SHALL display a Tooltip on hover and keyboard focus that explains the
   reasoning mode in plain language (e.g. "Heuristic mode uses rule-based analysis. LLM mode
   uses an AI model for deeper reasoning").
3. THE Confidence_Badge SHALL NOT display the raw value "confidence: high" — instead THE
   Confidence_Badge SHALL display a human-readable label such as "High confidence" with an
   appropriate colour indicator.
4. THE Reasoning_Badge SHALL NOT display the raw internal value (e.g. "heuristic") alone —
   instead THE Reasoning_Badge SHALL display a human-readable label such as "Rule-based" or
   "AI-powered".
5. THE Detail_Card SHALL NOT display the raw UUID as visible text in the default view; THE
   Detail_Card SHALL show a short human-readable pack identifier (e.g. "Pack #3" or a truncated
   ID) with the full UUID accessible via a Tooltip on hover.

---

### Requirement 5: Simplified and Prioritised Action Bar

**User Story:** As a user viewing a pack, I want the action buttons to feel manageable and
prioritised, so that I can find the most important actions quickly without feeling overwhelmed.

#### Acceptance Criteria

1. THE Action_Bar SHALL visually group actions into two tiers: primary actions (Export, Re-run)
   displayed as prominent buttons, and secondary actions (Duplicate, Star, Archive, Delete)
   displayed as smaller ghost buttons or placed in an overflow menu.
2. THE Action_Bar SHALL display the Delete button only inside a secondary overflow menu or after
   a deliberate "More actions" click, so that it is not immediately visible alongside primary
   actions.
3. WHEN the user clicks Delete, THE App SHALL require a two-step confirmation: first click
   changes the button label to "Confirm delete", second click executes the deletion.
4. THE Action_Bar SHALL display no more than four buttons at the top level on desktop viewports
   (width ≥ 900px).
5. WHEN the viewport width is less than 900px, THE Action_Bar SHALL collapse all secondary
   actions into a single "More" overflow menu button.

---

### Requirement 6: Informative and Actionable Error Messages

**User Story:** As a user who encounters an error, I want the error message to tell me what went
wrong and what I can do next, so that I am not left stuck with no path forward.

#### Acceptance Criteria

1. WHEN the Generator_Form encounters a generation error, THE App SHALL display an error message
   that includes: (a) a plain-language description of what failed, (b) a suggested recovery
   action (e.g. "Try again" button or "Check your connection"), and (c) a dismissible close
   button.
2. WHEN the Sidebar fails to load packs, THE App SHALL display an error message with a "Retry"
   button that re-triggers the load.
3. WHEN the GitHub Issue creation fails in the Publish tab, THE App SHALL display an error
   message that includes the specific reason (e.g. "Repository not found" or "Authentication
   failed") and a link to the relevant GitHub settings page.
4. IF a form field is submitted empty when a value is required, THEN THE App SHALL display an
   inline validation message adjacent to the field, not only as a generic alert at the top of
   the form.
5. THE App SHALL NOT display raw JavaScript error objects or stack traces to the user; THE App
   SHALL translate all caught errors into plain-language messages before display.

---

### Requirement 7: Meaningful Empty States

**User Story:** As a user with no packs selected or no packs saved, I want the empty area to guide
me toward the next action, so that I never feel stuck looking at a blank screen.

#### Acceptance Criteria

1. WHEN the App is in First_Visit state and no pack is selected, THE Detail_Card area SHALL
   display a getting-started empty state with a clear call-to-action pointing to the
   Generator_Form above.
2. WHEN packs exist but none is selected, THE Detail_Card area SHALL display a prompt such as
   "Select a pack from the list to view its details" with a visual arrow or indicator pointing
   toward the Sidebar.
3. WHEN the Sidebar search returns no results, THE Sidebar SHALL display the message "No packs
   match your search" with a "Clear search" button.
4. WHEN a Filter_Pill is active and no packs match the filter, THE Sidebar SHALL display the
   message "No packs in this group" with a "Show all packs" button that resets the filter to
   "All".
5. THE empty state in the Detail_Card area SHALL NOT use the generic clipboard icon (📋) as the
   sole visual; THE App SHALL use a contextually relevant illustration or icon paired with
   actionable text.

---

### Requirement 8: Policy Warning Clarity

**User Story:** As a user who sees a policy warning, I want to understand what the warning means
and why it matters, so that I can make an informed decision before approving a pack.

#### Acceptance Criteria

1. WHEN a Policy_Warning is displayed, THE App SHALL show a plain-language explanation of what
   a policy warning is (e.g. "This pack touches areas marked as protected in your repository
   policy. Review before approving.") above the list of individual warnings.
2. WHEN a Policy_Warning is displayed, THE App SHALL show each individual warning as a
   human-readable sentence, not a raw policy key or code.
3. THE Policy_Warning alert SHALL include a "What is this?" expandable section that explains
   the policy system in two to three sentences for users unfamiliar with it.
4. WHEN the user clicks "Acknowledge Warnings", THE App SHALL display a brief confirmation
   message (e.g. "Warnings acknowledged — you can now approve this pack") that auto-dismisses
   after 3 seconds.
5. IF a pack has unacknowledged Policy_Warnings and the user attempts to set the status to
   "Approved", THEN THE App SHALL display the blocking message adjacent to the Status_Dropdown,
   not only as a separate status indicator.

---

### Requirement 9: Quality Bar and Suggestions Clarity

**User Story:** As a user typing a goal, I want the quality bar and suggestions to help me write
a better goal, so that I understand what "good" looks like before I generate a pack.

#### Acceptance Criteria

1. THE Quality_Bar SHALL display a plain-language label alongside the progress bar that
   describes the current quality level: "Needs more detail" (vague), "Getting there" (partial),
   or "Looks good" (clear) — instead of the raw level names "vague", "partial", "clear".
2. WHEN the quality level is "vague" or "partial", THE Quality_Bar SHALL display at least one
   concrete suggestion showing an example of how to improve the goal text.
3. THE Quality_Bar suggestions SHALL be phrased as actionable instructions (e.g. "Add what
   should NOT change, e.g. 'do not break the billing flow'") rather than abstract criteria.
4. WHEN the quality level reaches "clear", THE Quality_Bar SHALL display a positive confirmation
   message (e.g. "Your goal is specific enough to generate a high-quality pack").
5. THE Quality_Bar SHALL be visually contained within the Generator_Form card and SHALL NOT
   appear to be a separate unrelated element.

---

### Requirement 10: Responsive and Accessible Visual Design

**User Story:** As a user on any device or with accessibility needs, I want the interface to be
readable, navigable, and usable, so that I can work effectively regardless of my setup.

#### Acceptance Criteria

1. THE App SHALL maintain a minimum text contrast ratio of 4.5:1 for all body text and 3:1 for
   all large text (18px bold or 24px regular) against their respective backgrounds, measured
   using the WCAG 2.1 AA contrast formula.
2. THE App SHALL ensure all interactive elements (buttons, inputs, links, filter pills) are
   reachable and operable via keyboard navigation in a logical tab order.
3. THE App SHALL display all interactive elements with a visible focus indicator (minimum 2px
   outline using the existing --focus-ring token) when focused via keyboard.
4. WHEN the viewport width is less than 900px, THE App SHALL stack the Sidebar above the
   Detail_Card in a single-column layout with no horizontal overflow.
5. THE App SHALL ensure all icon-only buttons include an accessible label via aria-label or a
   visible text label, so that screen reader users can identify the button's purpose.
6. THE App SHALL use a base font size of no less than 14px for all body text and input
   placeholder text to ensure readability without browser zoom.

---

### Requirement 11: Clarifying Questions Flow Separation

**User Story:** As a user whose goal triggered clarifying questions, I want the questions to feel
like a distinct guided step, so that I understand I am in a different mode and know how to proceed.

#### Acceptance Criteria

1. WHEN the Clarifying_Questions_Panel is shown, THE Generator_Form SHALL visually distinguish
   the panel from the goal input using a contrasting background colour and a clear step label
   (e.g. "Step 2 of 2 — Answer a few questions").
2. THE Clarifying_Questions_Panel SHALL display a progress indicator showing how many questions
   are present (e.g. "3 questions").
3. WHEN the Clarifying_Questions_Panel is shown, THE Generator_Form SHALL dim or visually
   de-emphasise the goal and context textareas to signal they are read-only in this step.
4. THE Clarifying_Questions_Panel SHALL display a "Skip all questions" button and a "← Back to
   goal" button with clear labels, so the user always has an obvious exit path.
5. WHEN the user submits answers from the Clarifying_Questions_Panel, THE App SHALL display a
   brief loading state labelled "Generating your pack…" rather than a generic spinner.

---

### Requirement 12: Header and Branding Clarity

**User Story:** As a first-time user reading the header, I want to immediately understand what
Ghostrail is, so that the product name and tagline set accurate expectations.

#### Acceptance Criteria

1. THE App header SHALL display the tagline "AI Guardrails for Coding Work" instead of "Intent
   Pack Generator", so that the header communicates the product's purpose rather than a
   feature name.
2. THE App header SHALL maintain the existing sticky positioning and blur backdrop so that
   navigation context is always visible while scrolling.
3. WHERE a help or documentation link is available, THE App header SHALL include a "Help" link
   or icon button that opens relevant documentation or an in-app guide.
4. THE logo-icon SHALL use a recognisable symbol that is consistent with the product's
   guardrail/safety theme (e.g. a shield or rail icon) rather than a generic lightning bolt,
   to reinforce brand identity.
