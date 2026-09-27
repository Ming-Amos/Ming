# Ming submission video

Final deliverables: `submission/ming-demo.mp4` and `submission/ming-demo.srt`.

The MP4 is **2 minutes 44 seconds**, 1600 × 900 at 30 fps, H.264 with AAC mono English narration at 48 kHz. English subtitles and scene labels are burned into a separate navy band below the original application recording. The SRT is supplied separately. Narration was synthesized offline with Microsoft Zira Desktop; no cloud speech service, Bob request, or model API call was used to produce the video.

## What the video demonstrates

| Time | Actual footage |
| --- | --- |
| 0:00–0:15 | The manual-checking problem, with the real Ming interface visible. |
| 0:15–0:32 | Review the sample's clearly labelled hand-authored acceptance plan and dependencies. |
| 0:32–0:48 | Confirm and execute a new real browser run against the deliberately buggy daily-report sample. Submission and blank-input checks pass; persistence fails. |
| 0:48–1:04 | Inspect the real assertion and original screenshots. |
| 1:04–1:20 | Create a real waiting repair task and inspect its English MCP handoff. Creating the task does not wake an agent or repair the source. |
| 1:20–2:06 | Interactively review an **earlier, genuinely recorded Codex MCP repair**, its same-plan comparison, before/after screenshots and complete rerun. Narration and chapter labels explicitly identify this as an earlier recorded repair, not a live repair occurring during the video. |
| 2:06–2:21 | Switch to the independent Focus task-manager sample; confirm and execute a new real browser run. Creation, completion and persistence checks pass. |
| 2:21–2:30 | Show the real unconfigured-model status. The demo uses preset plans and makes no live model request. |
| 2:30–2:44 | Show the complete, authentic Bob Stage B task-summary screenshot and explain Bob/Codex contributions. |

**150 seconds show the actual working application, including interactive review of real historical evidence.** Excluding the first 15-second problem introduction leaves 135 seconds of solution operation/review. The final 14-second Bob summary still is not counted as application operation. The video is under three minutes and exceeds the required 90 seconds of solution demonstration.

## Evidence provenance

- New live buggy run: `55488c50-5613-43a4-a96e-c1da5e1f60fe`.
- New waiting task: `531406ff-7ead-4703-8714-10c47dad0194`. This task remains waiting; the video does not imply that it was repaired.
- New live Focus run: `1f84019e-618b-4033-abd3-b66734e6e86f`.
- Earlier repair baseline: `65aece9c-b145-4045-8096-60331a4c6ae1`.
- Earlier repaired rerun: `2cf3cc33-507f-41c2-8b9f-6a16c712a7ae`.
- Earlier repair task: `7ed27f84-aa14-43f8-90e2-f84702dc21b0`, performed by **Codex using the real stdio MCP tools**. Bob is not credited as the repair actor.
- Genuine Bob image: `bob_sessions/ming_task03_stage_b_final_summary.png`, shown complete without changing its contents.
- Recorded repair source/evidence references: `docs/demo-evidence/manifest.json` and its included runtime records.

Bob contributed the core runner, evidence history, model adapter and repair foundations. Codex completed the final interface/integrity work and the recorded repair. The demonstrated scope is registered self-contained sample web projects; no claim is made that arbitrary projects work without configuration, or that an unconfigured model generated these plans.

## Production and checks

Playwright recorded actual clicks in the local application at port 4000, using the real API at port 4001. It did not rewrite page results, substitute fabricated screenshots, or change sample source files. The new runs and waiting task are real ordinary UI mutations. The browser recording completed with zero uncaught page exceptions. Main application processes were left running.

All frames and audio decoded successfully through FFmpeg. Twelve sampled frames at 0:04, 0:24, 0:40, 0:58, 1:10, 1:31, 1:46, 2:00, 2:16, 2:25, 2:38 and 2:43 were visually reviewed for readable captions, unclipped layouts, correct scene/provenance labels and unintended sensitive content. Final audio measurement was −16.4 dB mean and −1.2 dB peak, with no clipping. This is technical audio verification; no claim of an independent human listening review is made.

The final file is approximately 10 MB, below GitHub's 100 MB single-file limit. Private working material, including the raw recording, action timings, generated speech, subtitle source, probe output and QA frames, remains under ignored `runtime/submission-video/`.

Reproduction scripts: `scripts/record-submission-demo.mjs`, `scripts/build-demo-narration.ps1`, and `scripts/build-demo-narration.py`. Re-recording creates new real sample runs and a waiting task; it should not be invoked merely to review the finished artifact.
