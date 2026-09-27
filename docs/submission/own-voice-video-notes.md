# Ming video — authorized owner-voice narration edition

Current delivery files: [ming-demo-own-voice.mp4](../../submission/ming-demo-own-voice.mp4) and [ming-demo-own-voice.srt](../../submission/ming-demo-own-voice.srt).

This edition uses **synthetic narration based on the project owner's own voice, with their authorization**. The owner approved the pilot's voice character and requested a more natural, relaxed delivery. The English script was rewritten into shorter, conversational clauses. This describes the requested direction; it is not a claim that the result is indistinguishable from human speech or that the owner spoke the final English narration.

## What changed

Ten narration scenes were generated with **Qwen3-TTS-12Hz-1.7B-Base**. The speech uses a 0.94 tempo adjustment with pitch preserved. Thirty-two English subtitle cues follow speech-recognition alignment to the new audio. The captions retain the canonical English script and intended product names; recognition spelling differences do not rewrite that script.

Narration and captions were revised. The Bob evidence still at **2:16–2:37** now displays the complete, unaltered [original Stage A summary](../../bob_sessions/ming_task02_stage_a_final_summary.png), task `2b41a80061020f364f496c02d0c9c5e7`. The **172-second (2:52)** timeline and **122 seconds of actual application operation** retain their original timing. The original [scene guide and recording provenance](video-notes.md) document the real ten-step checklist request, persistence failure, copied repair brief, prepared corrected upload, same-plan passing result, and original Bob summary. This edition does not add a new acceptance run, call Bob, or make another Doubao request. Cloud speech generation is separate from the product's recorded model-planning request.

The owner's reference audio, reference transcript, cloud connection details, workflow data, and generated raw voice files remain private and are excluded from this repository's delivery materials.

## Preservation

- The [previous 172-second MP4](../../submission/ming-demo.mp4) and [30-cue SRT](../../submission/ming-demo.srt) remain unchanged, including the hashes protected by the [original evidence manifest](../evidence/current-video/2026-09-27/manifest.json).
- The [164-second prototype MP4](../../submission/archive/ming-demo-prototype.mp4), its [subtitles](../../submission/archive/ming-demo-prototype.srt), and the original Bob screenshots remain unchanged.
- Acceptance results and images are not repainted. The prepared corrected app is not presented as an AI repair performed during the recording. No independent human listening review of the complete new edition is claimed.

## Final media verification

Final media verification passed for this edition. Twelve sampled frames, including the replacement evidence still and its captions, were inspected.

| Check | Result |
| --- | --- |
| Final video duration and format | 172.0 seconds; 1600 × 900, 30 fps, H.264 + AAC |
| Full audio/video decode | Passed across the complete file |
| Caption readability and scene timing | 12 sampled frames reviewed; 32 cues aligned; no picture-timeline speed change |
| Audio level and clipping check | −16.22 LUFS integrated; −1.06 dBTP peak, below clipping |
| MP4 byte size and SHA-256 | 13,505,431 bytes; `72aa6a57b98216f766d510de82422a1288437d0c969c6158d1b3eaed451d71bb` |
| SRT cue count and SHA-256 | 32 cues; `64329f2130bba726016768e6b2173bd156a41ddae1e2de5ec2ff9b20550933f0` |

This is a separate narration edition of the same demonstration, not an additional application validation or a formal event submission.
