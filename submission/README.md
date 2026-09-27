# Ming submission package

Submitted materials for the IBM Bob 2.0 Hackathon. The English presentation, statements, and narrated video describe the current product. The video records its guided workflow, real model request, and actual browser checks. The platform confirmed successful submission on September 27, 2026. See the [official entry](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/ming/ming-every-done-comes-with-proof) and [submission record](../docs/submission/SUBMITTED.md).

## Presentation and statements

| Material | File | Status |
| --- | --- | --- |
| Editable presentation | [ming-slides.pptx](ming-slides.pptx) | Current eight-slide English deck; editable text, embedded evidence, and speaker notes. |
| PDF presentation | [ming-slides.pdf](ming-slides.pdf) | Matching eight-slide static companion. |
| Speaker notes and sources | [Current deck notes](../docs/submission/deck-notes.md) | Exact evidence sources and scope for all eight slides. |
| Problem & Solution Statement | [problem-solution.md](../docs/submission/problem-solution.md) | 386 words; copy only the body below the divider. |
| IBM Bob Usage Statement | [bob-usage.md](../docs/submission/bob-usage.md) | 353 words; copy only the body below the divider. |
| Submission form values | [fields.md](../docs/submission/fields.md) | Title, description, technology tags, links, capability boundaries, and outstanding items. |

The deck distinguishes the current-interface screenshot from the separate real nine-step model verification. It also separates the hosted copy-and-paste repair handoff from the genuine local MCP source repair by a coding assistant.

## Original Bob records

- [Bob session evidence index](../bob_sessions/README.md): four distinct tasks, their actual contributions, and the partial Stage C interruption.
- [Screenshot manifest](../bob_sessions/manifest.json): SHA-256 hashes and provenance for eight original images: four summaries, three intermediate captures, and one connection view.
- [Original Stage A summary shown in the deck](../bob_sessions/ming_task02_stage_a_final_summary.png).

Original images remain unchanged. The connected-tools view demonstrates registration, not a Bob source repair. Later product work and the recorded local repair are identified separately from Bob's initial contribution.

## Current video, cover, and archive

| Material | File | Status |
| --- | --- | --- |
| Cover artwork | [ming-cover.png](ming-cover.png) | Prepared concept artwork; not browser execution evidence. |
| Current demonstration video | [ming-demo-own-voice.mp4](ming-demo-own-voice.mp4) | Authorized synthetic owner-voice narration with a conversational English script. Same 172-second picture timeline and 122 seconds of actual app operation; no new acceptance or model-planning run. [Media status](../docs/submission/own-voice-video-notes.md). |
| Current video subtitles | [ming-demo-own-voice.srt](ming-demo-own-voice.srt) | Thirty-two English cues aligned to the new narration. Canonical script spelling is retained rather than copying recognition errors. |
| Current video sources and scene guide | [Narration edition notes](../docs/submission/own-voice-video-notes.md) and [original recording notes](../docs/submission/video-notes.md) | Narration provenance, media status, unchanged scene timings, and genuine provider/browser-run identities. |
| Previous narration edition | [ming-demo.mp4](ming-demo.mp4) and [ming-demo.srt](ming-demo.srt) | Original 172-second edit with offline Zira narration and 30 caption cues, preserved byte-for-byte. It shows the same actual application take as the current edition. |
| Earlier demonstration video | [Archived prototype MP4](archive/ming-demo-prototype.mp4) and [SRT](archive/ming-demo-prototype.srt) | Historical 164-second (2:44) prototype recording, retained separately from the current video. |
| Earlier video notes | [Archived prototype video notes](../docs/submission/archive/video-notes-prototype.md) | Original notes preserved byte-for-byte. |
| Earlier deck notes | [Archived prototype notes](../docs/submission/archive/deck-notes-prototype.md) | Preserved documentation of the previous five-slide presentation. |
| Earlier presentation | [Archived prototype PDF](archive/ming-slides-prototype.pdf) | Original five-slide file preserved unchanged; use the current eight-slide deck above. |

## Public access and submission

The [application](https://ming-acceptance-proof.amosming.chatgpt.site) and [GitHub repository](https://github.com/Ming-Amos/Ming) are public. Fresh anonymous browser checks confirmed that judges can open the welcome page, Start workflow, and guided sample without signing in.

The platform confirmed successful submission. See the [submission record](../docs/submission/SUBMITTED.md) for the official entry, selected files, and access verification. Submission confirmation does not establish the organizer's eligibility decision or judging outcome.

## Rebuilding the presentation

The presentation uses the installed artifact runtime, with `RUNTIME_NODE_MODULES` pointing to its Node modules and `PRESENTATION_SKILL_DIR` pointing to the presentation skill. Set `PYTHON_EXECUTABLE` to a Python environment containing the skill's validator dependencies. Run the [deck builder](../scripts/build-submission-presentation.mjs), then the [finalizer](../scripts/finalize-submission-presentation.mjs). The finalizer checks the PPTX and renders its pages. Run the [PDF exporter](../scripts/export-submission-pdf.py) with `reportlab` and `pypdf` available. Review every final render before copying the two output files from `runtime/submission-deck-20260927/output/` to this folder. These commands do not contact Bob or a language model.
