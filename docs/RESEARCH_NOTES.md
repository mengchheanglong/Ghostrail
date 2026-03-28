# Research Notes

This file records the internet research that informed the project choice.

## What the current market is doing

### GitHub Copilot coding agent
GitHub’s docs and blog show that Copilot coding agent is strongest when the task is incremental, testable, and clearly scoped. It works through issues or chat prompts, runs in a GitHub Actions-powered environment, and creates pull requests for review.

Sources:
- https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent
- https://docs.github.com/en/copilot/get-started/features
- https://docs.github.com/en/copilot/how-tos/agents/copilot-coding-agent/best-practices-for-using-copilot-to-work-on-tasks
- https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/
- https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/

### Where the pressure is building
GitHub has written that AI is making code, issues, and security reports cheaper to generate, while review capacity has not scaled at the same rate. Maintainers are feeling this as more volume without proportional clarity.

Sources:
- https://github.blog/open-source/maintainers/welcome-to-the-eternal-september-of-open-source-heres-what-we-plan-to-do-for-maintainers/
- https://github.blog/open-source/maintainers/what-to-expect-for-open-source-in-2026/
- https://github.blog/open-source/maintainers/rethinking-open-source-mentorship-in-the-ai-era/

### Spec-driven development is real, but incomplete
GitHub has explicitly pushed spec-driven development. That validates the direction, but most current workflows still focus more on the spec creation step than on preserving non-goals, detecting drift, or proving alignment after code is generated.

Sources:
- https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/
- https://github.blog/ai-and-ml/generative-ai/spec-driven-development-using-markdown-as-a-programming-language-when-building-with-ai/

### AI-native software and agent governance are rising themes
SAP and other enterprise voices are framing 2026 as a shift toward AI-native software, not just AI add-ons. In parallel, governance and trust are emerging as bottlenecks.

Sources:
- https://news.sap.com/2026/01/ai-in-2026-five-defining-themes/
- https://internationalaisafetyreport.org/publication/international-ai-safety-report-2026
- https://cloudsecurityalliance.org/press-releases/2026/03/24/more-than-two-thirds-of-organizations-cannot-clearly-distinguish-ai-agent-from-human-actions
- https://cloudsecurityalliance.org/artifacts/identity-and-access-gaps-in-the-age-of-autonomous-ai

### Interfaces are becoming more dynamic
Google’s A2UI work and Google Research’s generative UI work both suggest that interfaces can increasingly be shaped at runtime by agent context. That makes “review cards” and dynamic task surfaces more plausible as a future Ghostrail feature.

Sources:
- https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/
- https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/

## Why Ghostrail was selected

The idea is not that specs are new.
The idea is that **reviewable intent preservation for coding agents** still looks underbuilt.

Ghostrail was selected because it fits five conditions:

1. useful immediately for a solo builder
2. naturally compatible with GitHub Copilot Agent
3. narrow enough for incremental build-out
4. aligned with a real market pain point
5. capable of expanding into a larger category later

## Important honesty note

I cannot prove that nobody has built something similar.
There are adjacent tools around specs, context engines, and guardrails.
The claim here is narrower:

**Ghostrail’s specific combination of intent packs, non-goal capture, issue export, and future PR drift checking still appears underexplored and worth building.**
