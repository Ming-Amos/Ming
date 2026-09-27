# Ming submission package

Current materials for the IBM Bob 2.0 Hackathon. The English presentation and statements describe the current product; the video remains a clearly identified historical recording. This folder is a delivery package, not a submitted entry.

## Presentation and statements

| Material | File | Status |
| --- | --- | --- |
| Editable presentation | [ming-slides.pptx](ming-slides.pptx) | Current eight-slide English deck; editable text, embedded evidence, and speaker notes. |
| PDF presentation | [ming-slides.pdf](ming-slides.pdf) | Matching eight-slide static companion. |
| Speaker notes and sources | [Current deck notes](../docs/submission/deck-notes.md) | Exact evidence sources and scope for all eight slides. |
| Problem & Solution Statement | [problem-solution.md](../docs/submission/problem-solution.md) | 383 words; copy only the body below the divider. |
| IBM Bob Usage Statement | [bob-usage.md](../docs/submission/bob-usage.md) | 357 words; copy only the body below the divider. |
| Submission form values | [fields.md](../docs/submission/fields.md) | Title, description, technology tags, links, capability boundaries, and outstanding items. |

The deck distinguishes the current-interface screenshot from the separate real nine-step model verification. It also separates the hosted copy-and-paste repair handoff from the genuine local Codex MCP source repair.

## Original Bob records

- [Bob session evidence index](../bob_sessions/README.md): four distinct tasks, their actual contributions, and the partial Stage C interruption.
- [Screenshot manifest](../bob_sessions/manifest.json): SHA-256 hashes and provenance for eight original images: four summaries, three intermediate captures, and one connection view.
- [Original Stage B summary shown in the deck](../bob_sessions/ming_task03_stage_b_final_summary.png).

Original images remain unchanged. The connected-tools view demonstrates registration, not a Bob source repair. Later product work and the recorded local repair are attributed to Codex.

## Cover and historical video

| Material | File | Status |
| --- | --- | --- |
| Cover artwork | [ming-cover.png](ming-cover.png) | Prepared concept artwork; not browser execution evidence. |
| Earlier demonstration video | [ming-demo.mp4](ming-demo.mp4) | **Historical prototype, 164 seconds (2:44).** English narration and captions. It does not show the current guided workflow or hosted model integration. |
| Earlier video subtitles | [ming-demo.srt](ming-demo.srt) | Companion subtitles for the historical recording. |
| Earlier deck notes | [Archived prototype notes](../docs/submission/archive/deck-notes-prototype.md) | Preserved documentation of the previous five-slide presentation. |
| Earlier presentation | [Archived prototype PDF](archive/ming-slides-prototype.pdf) | Original five-slide file preserved unchanged; use the current eight-slide deck above. |

## Access and remaining work

The [application](https://ming-acceptance-proof.amosming.chatgpt.site) and [GitHub repository](https://github.com/Ming-Amos/Ming) are still private. They need authorized visibility changes and verification without the owner's session before use as public judging links.

Remaining: record a current demonstration video, verify judge access, confirm the organizer's account conditions, review the actual form, and submit the entry. No formal submission or public publication is claimed here. See [delivery status](../docs/DELIVERY_STATUS.md) for the application and material checkpoints.

## Rebuilding the presentation

The presentation uses the installed Codex artifact runtime, with `RUNTIME_NODE_MODULES` pointing to its Node modules and `PRESENTATION_SKILL_DIR` pointing to the presentation skill. Set `PYTHON_EXECUTABLE` to a Python environment containing the skill's validator dependencies. Run the [deck builder](../scripts/build-submission-presentation.mjs), then the [finalizer](../scripts/finalize-submission-presentation.mjs). The finalizer checks the PPTX and renders its pages. Run the [PDF exporter](../scripts/export-submission-pdf.py) with `reportlab` and `pypdf` available. Review every final render before copying the two output files from `runtime/submission-deck-20260927/output/` to this folder. These commands do not contact Bob or a language model.
