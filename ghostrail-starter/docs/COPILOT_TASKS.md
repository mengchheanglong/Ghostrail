# GitHub Copilot Agent Tasks

These are good first issues to assign to Copilot.
Keep them separate and incremental.

---

## Task 1 — Persist Intent Packs locally
**Goal**
Add a storage layer that saves each generated Intent Pack to disk as JSON files in a `/data/intent-packs` folder.

**Requirements**
- Create a stable id for each pack.
- Save created timestamp.
- Add `GET /api/intent-packs`.
- Add `GET /api/intent-packs/:id`.
- Keep current API behavior working.
- Add tests.

**Acceptance criteria**
- I can create a pack and fetch it later.
- Invalid ids return 404 JSON.
- Build and tests pass.

---

## Task 2 — Add editable review step in UI
**Goal**
Let users edit the generated Intent Pack before saving it.

**Requirements**
- Show editable fields for objective, non-goals, constraints, acceptance criteria, risks, and questions.
- Add save button.
- Add error state.
- Do not add frameworks yet; keep it simple.

**Acceptance criteria**
- Generated content can be edited in browser.
- Edited pack persists correctly.

---

## Task 3 — Add GitHub issue export
**Goal**
Generate a GitHub issue markdown block from an Intent Pack.

**Requirements**
- Add a pure function that converts an Intent Pack into issue markdown.
- Add `POST /api/intent-pack/export-issue`.
- Show export result in the UI.
- Add tests for markdown output.

**Acceptance criteria**
- The generated markdown includes objective, non-goals, constraints, acceptance criteria, risks, and open questions.

---

## Task 4 — Add repository policy zones
**Goal**
Add a repository policy file that defines protected paths and protected behaviors.

**Requirements**
- Create a `ghostrail.policy.json` file format.
- Validate it on startup.
- When generating an Intent Pack, add warnings if repository context mentions protected areas.
- Add tests.

**Acceptance criteria**
- Invalid policy file fails loudly.
- Warnings appear when protected zones are relevant.

---

## Task 5 — Add PR drift evaluation stub
**Goal**
Create the first version of PR drift evaluation.

**Requirements**
- Accept an Intent Pack and a mock PR summary.
- Return a drift report with: aligned changes, possible drift, policy warnings, missing proof.
- Keep this rule-based for now.
- Add tests.

**Acceptance criteria**
- Endpoint returns structured drift report JSON.
- Unit tests cover obvious aligned and drift cases.
