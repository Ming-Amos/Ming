# Submission fields — submitted entry

Updated 2026-09-27. The event platform confirmed successful submission at approximately **18:55 Asia/Shanghai (UTC+08:00)**. [View the submission](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/ming/ming-every-done-comes-with-proof); the [submission record](SUBMITTED.md) lists the selected files and receipt. The current product includes the guided **Add app → Describe → Review → Results** workspace, actual static-project browser checks, an explicitly requested Doubao checklist, and a separate local MCP repair workflow. Latest implementation, deployment, and evidence scopes are in [Delivery status](../DELIVERY_STATUS.md).

## Project title

Ming - Every Done Comes with Proof

## Tagline

Every “done” comes with proof.

## Short description

Ming turns requirements into reviewed browser checks, captures what failed, and gives your coding AI evidence to fix it. Bring back the updated app and verify it against the same checklist.

## Technology tags

**Actual form selection: Ibm.** The available dropdown has no dedicated IBM Bob or Doubao tag. The implementation technologies below describe the product; they are not additional selected form tags.

- IBM Bob
- TypeScript
- React
- Node.js
- Playwright
- Model Context Protocol (MCP)
- Doubao Seed 2.0 Pro, if available

## Categories selected in the form

- Developer Tools
- Productivity

## Form values and readiness

| Field | Value / readiness |
| --- | --- |
| Long Description | Copy only the statement body from [problem-solution.md](problem-solution.md): **386 words**, maximum 500. |
| IBM Bob Usage Statement | Copy only the statement body from [bob-usage.md](bob-usage.md): **353 words**, maximum 500. |
| Public Code Repository | [Ming repository](https://github.com/Ming-Amos/Ming) — **public**. Anonymous GitHub API access confirms the repository is public. |
| Demo Application Platform | **Other** selected in the form. Browser web application built with React and TypeScript. Static-project checks execute in the visitor's browser; a server-side Doubao integration proposes checklists. The optional local companion uses Node.js, Playwright, and MCP. |
| Application URL | [Ming application](https://ming-acceptance-proof.amosming.chatgpt.site) — **public**. Fresh anonymous browser access returns the welcome page without a login gate; Start and Try a guided sample open their respective workflows. The deployed app runs static-project checks and a live sample; Evidence Studio separately replays recorded proof. |
| Bob task summaries | Original screenshots in [bob_sessions](../../bob_sessions/README.md), including completed Stage A/B and the interrupted Stage C task. The separate connected-tools screenshot proves registration only. |
| Cover image | Uploaded PNG: [ming-cover.png](../../submission/ming-cover.png) — concept artwork, not execution evidence. |
| Video | Uploaded MP4: [ming-demo-own-voice.mp4](../../submission/ming-demo-own-voice.mp4). [English subtitles](../../submission/ming-demo-own-voice.srt) are also retained in the repository. Authorized synthetic owner-voice narration over the same **172-second** picture timeline, including 122 seconds of actual app operation. Current guided UI, one genuine ten-step model draft, real failure, copied repair instructions, and prepared corrected source passing the same plan. See [narration edition and media status](own-voice-video-notes.md). The [previous 172-second narration edition](../../submission/ming-demo.mp4) and [164-second prototype](../../submission/archive/ming-demo-prototype.mp4) remain unchanged. |
| Slide presentation | Uploaded: [PDF](../../submission/ming-slides.pdf). The [editable PowerPoint](../../submission/ming-slides.pptx) is also retained in the repository. Eight English slides cover the current workflow, genuine hosted model evidence, repair handoff, and Bob attribution. [Current speaker notes and sources](deck-notes.md); [archived prototype notes](archive/deck-notes-prototype.md). |

## What the current product actually does

**Hosted own-project path.** Add a self-contained HTML file, static ZIP, or a browser-ready folder in a public GitHub repository. GitHub imports retain the exact commit and folder. Describe what should work, explicitly choose **Create my checklist**, review the proposed actions and passing conditions, then choose **Approve and check**. That action approves the visible checklist and starts real browser execution. Unanswered questions and changed inputs block stale approval. Manual authoring remains under **Advanced options**.

Seed 2.0 Pro proposes the checklist; browser actions and assertions determine the results. Model generation is an explicit, potentially billable request using a server-side secret. Importing files, manual checks, and running a checklist make no model request. The report records plan origin and actual provider-reported usage when available.

Results contain expected versus observed behavior, actual DOM-rendered snapshots, source/plan identities, and a portable JSON report. **Copy instructions for my AI** copies a repair brief; the user supplies it to their coding assistant. **Check an updated app** returns to the upload flow so the same standard can be run against revised source. The website does not edit repositories, wake a coding agent, or claim the external source correction as its own work.

The hosted preview supports browser-ready static projects: no package installation, backend execution, arbitrary remote APIs, or private GitHub import. Its storage adapter simulates session persistence; its images are DOM renders, not native browser screenshots. Results stay in page memory unless exported. A passing result covers the approved checks, not every requirement or application feature.

**Local companion.** Register a supported same-origin local development URL or a self-contained HTML file. The local Playwright runner captures browser screenshots and saves requirements, plan revisions, confirmations, and history. An authorized coding agent can use 12 MCP tools to read a failure, claim a repair task, edit the target source with its own tools, and rerun the original plan. Creating a task does not automatically start the agent.

**Visual presentation.** The animated welcome scene illustrates inspection; it is not a live acceptance result. The workspace uses a restrained dark theme and readable checklist cards. Evidence Studio's scrubber and comparison slider explore preserved recordings, separately from new live execution.

## Evidence to use without mixing claims

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| [Current narrated video](own-voice-video-notes.md), [original recording notes](video-notes.md), and [recording metadata](../evidence/current-video/2026-09-27/recording.json) | The current compiled guided UI made one genuine Seed 2.0 Pro request: **ten steps**, 965 input and 566 output tokens. The real buggy upload failed persistence; prepared corrected source passed the unchanged plan, with original failure evidence preserved. The recording contains 122 seconds of actual application operation. The owner-voice edition revises narration and captions and replaces the Bob evidence still with the complete, unaltered original Stage A summary; the application-operation footage and timing are preserved. | This take runs the current app locally, not on the production domain. It does not show an AI editing source, ZIP/GitHub import, or complete application coverage. The new narration is not an additional model-planning or acceptance run. |
| [Hosted Shipboard model verification](../PLANNER_FORMAT_INCIDENT.md) | One real Seed 2.0 Pro request generated **nine steps** for empty-input validation, task creation, and persistence. The buggy upload failed after reload; the prepared corrected upload passed the unchanged plan. Production verification: **15/15**. | The model did not repair the source. Nine steps are not nine separate features. This recording predates the latest simplified interface. |
| [Local Shipboard MCP repair](../judge-evidence/README.md) | A coding assistant used actual stdio MCP, changed the same target's persistence code, and reran its unchanged **three-criterion, hand-authored plan**. All three criteria passed with `verifiedRepair: true`; original evidence was preserved. | This plan was not generated by Doubao, and Bob did not perform this later repair. |
| [Guided-workflow review](../SIMPLE_WORKFLOW_REVIEW.md) | Latest desktop/mobile flow passed **31/31** behavioral checks plus **7/7** final-copy checks. A real Field Notes app failed persistence, then revised files passed the same **five-step** plan. Stale/unresolved drafts, cancellation, duplicate approval, and manual authoring were checked. | Provider responses were explicit local fixtures; displayed fixture token counts are not actual model usage. This suite is not an additional live-model demonstration. |

A local running URL's successful rerun may be acceptance evidence while `verifiedRepair` remains false. Stronger source-bound repair verification needs captured source and matching plan, runner, and target identities; a source-directory hash alone does not prove what a running server executed.

Preserve original Bob summaries and both older evidence bundles. Attribute the initial core and repair/MCP foundations to Bob. Identify later implementation, hosted integration, interface changes, and the recorded source repair as subsequent development with additional tools. Do not add unmeasured time savings or general model-quality claims.

## Submission confirmation and access

- The final Submit action returned the platform's successful-submission confirmation. The receipt is retained locally at `C:\Bob\Projects\Ming\runtime\submission-success.png`; it is not a committed repository artifact.
- The repository and application are public. A fresh anonymous browser passed **6/6 access checks**, including the welcome page, Start opening Add app, and the guided-sample entry. The check made no model requests.
- Submitted values include the English title and short description, both statements, actual tags, cover PNG, owner-voice MP4, slide PDF, public repository, application URL, Other platform selection, and judge walkthrough. Anonymous post-submission verification confirmed the public entry, loaded cover, correct Demo/GitHub links, and a 172-second video. The public MP4 and PDF hashes exactly match the delivered files; details are in [SUBMITTED.md](SUBMITTED.md).
- Successful submission is recorded here without claiming a competition-eligibility determination or judging outcome.
