# Ming submission video — current guided workflow

**Current narration edition:** use [ming-demo-own-voice.mp4](../../submission/ming-demo-own-voice.mp4) and [its English subtitles](../../submission/ming-demo-own-voice.srt). It replaces the narration with an authorized synthetic version of the project owner's voice while preserving this recording's picture timeline, application results, and original evidence. See [owner-voice edition notes](own-voice-video-notes.md) for its production and media status. The details below describe the preserved previous narration edition and the genuine take shared by both editions.

Final deliverables: [ming-demo.mp4](../../submission/ming-demo.mp4) and [ming-demo.srt](../../submission/ming-demo.srt), **172 seconds (2:52)**. The [original 164-second video](../../submission/archive/ming-demo-prototype.mp4), [subtitles](../../submission/archive/ming-demo-prototype.srt), and [notes](archive/video-notes-prototype.md) are retained separately as historical material. The original notes are preserved byte-for-byte.

The new video shows the current **Add app → Describe → Review → Results** interface, one genuine Seed 2.0 Pro checklist request, a real browser failure, a copied repair brief, and the unchanged plan passing against prepared corrected source. **122 seconds show actual application operation**, excluding the animated introduction, Bob summary still, and closing. It is below three minutes and exceeds the required 90 seconds of solution operation.

## Scene guide

| Time | Actual footage and narration boundary |
| --- | --- |
| 0:00–0:14 | Animated welcome scene and the problem: an AI's “done” still leaves the developer with manual checking. Choose Start. The inspection animation is illustrative, not an acceptance result. |
| 0:14–0:29 | Upload the deliberately buggy, self-contained Shipboard HTML app. |
| 0:29–0:46 | Enter three requirements: reject an empty task name, create a named task, and retain that task after reload. |
| 0:46–1:03 | Explicitly choose **Create my checklist**. One real Seed 2.0 Pro request returns ten actions and assertions. The model proposes checks; it does not decide their results. |
| 1:03–1:20 | Read the proposed checklist and choose **Approve and check**. Real browser actions execute against the uploaded app. |
| 1:20–1:36 | Inspect the failed persistence check and expand its original DOM-rendered capture. The newly created task disappeared after reload. |
| 1:36–1:55 | Choose **Copy instructions for my AI** and inspect the actual copied brief. Copying does not contact an assistant or change the app. |
| 1:55–2:16 | Choose **Check an updated app**, upload the explicitly identified **prepared corrected source**, approve the unchanged plan, and inspect its passing comparison. No AI source repair happens during this recording. |
| 2:16–2:37 | Show the complete original Bob Stage B task-summary image. Explain Bob's initial foundations and the subsequent development that completed and extended the product. |
| 2:37–2:52 | Close with the product promise: observable results, portable failure evidence, and the same standard after a change. |

## Genuine execution and evidence

The [recording metadata](../evidence/current-video/2026-09-27/recording.json), [provider response](../evidence/current-video/2026-09-27/provider-draft.json), [failed run](../evidence/current-video/2026-09-27/failed-run.json), [passing comparison](../evidence/current-video/2026-09-27/passing-run.json), and [copied repair brief](../evidence/current-video/2026-09-27/repair-brief.txt) document this take.

- Current compiled UI: `index-eLFffDhU.js`, recorded locally at `http://127.0.0.1:4386` from source commit `21b5235b599d649eaaa78ec4a594641c5d809f2c`. This is a new local UI recording with a genuine external provider request, not a new production-domain verification.
- Exactly **one** recorded provider request, model `doubao-seed-2-0-pro-260215`: **965 input tokens and 566 output tokens**, as reported by the provider. The returned checklist has **ten steps for three requirements**, with no unanswered questions.
- Baseline run: `32f65c6f-f44f-4375-86de-57f17b0f851d`. Nine steps passed; the last assertion failed because no task item matched `#taskList > li` after reload.
- Revised run: `21b08592-0384-40d0-b2d3-96219fc13bd5`. All ten steps passed. The comparison records the same plan, entry, and source target, changed source bytes, and preservation of the original failed evidence.
- Both runs use plan fingerprint `256f552586b173407e042b76a6898fd27f7bf51781823aae0b25a1ab76b7b4e9`. The runner is `isolated-browser-dom`; captures are **DOM renders**, and storage uses a session adapter. They are not native browser screenshots or a claim of complete application coverage.
- The failed and corrected files are `examples/shipboard/buggy/index.html` and `examples/shipboard/normal/index.html`. The correction was prepared before recording and is labelled accordingly.
- The unchanged [Bob Stage B original](../../bob_sessions/ming_task03_stage_b_final_summary.png) has SHA-256 `ec5db2aa2586291610c11c531d5f1ab280be51689f02daaa4a811a3da859516c`. Showing this still makes no new Bob request.

The earlier [nine-step hosted model verification](../PLANNER_FORMAT_INCIDENT.md), the [five-step workflow test fixture](../SIMPLE_WORKFLOW_REVIEW.md), and the [three-criterion local MCP repair](../judge-evidence/README.md) remain separate evidence sets. None is substituted for this take's real ten-step provider response. The video demonstrates HTML upload; supported ZIP and public GitHub imports are not exercised on screen here.

## Production and review status

The successful ten-scene recording contains zero uncaught page errors, zero blocked requests, and one real checklist request. The final edit timeline is **172 seconds with no cuts to model waiting time**; actual application operation occupies 0:14–2:16. A separate locator rehearsal used an explicit provider fixture; that rehearsal was not used as the recorded model response.

The final video is 1600 × 900 at 30 fps, H.264 with AAC audio, with the original 1600 × 810 application capture above a separate caption band. English narration uses **Microsoft Zira Desktop offline**; the companion SRT has 30 cues timed from the measured sentence audio. Speech generation does not use a cloud speech service or Bob. This does not negate the one genuine, potentially billable model request made by the application on screen. Original app results, evidence images, and Bob records are not repainted.

Final media checks passed: duration **172.0 seconds**; all frames and audio decoded without errors; 16 sampled frames were reviewed for readable captions, correct scenes, and unintended sensitive content. Measured audio was **−17.6 dB mean and −1.4 dB peak**, with no clipping. This is technical audio verification, not a claim of independent human listening review. The MP4 is **14,271,594 bytes (approximately 13.61 MiB)**, SHA-256 `6d36df368b24176e19c75fce050011580876875b676729058e0b6893239d912c`. Private working files and QA artifacts remain under ignored `runtime/current-submission-video/`.

Reproduction sources: [record-current-demo.mjs](../../scripts/record-current-demo.mjs), [build-current-demo-voice.ps1](../../scripts/build-current-demo-voice.ps1), and [build-current-demo-video.py](../../scripts/build-current-demo-video.py). Recording again creates new real browser runs and, in record mode, a new billable provider request; reviewing the delivered video does neither.
