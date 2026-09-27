# Submission fields — current product review copy

Updated 2026-09-27. Prepared for review; not submitted. The current product includes the guided **Add app → Describe → Review → Results** workspace, actual static-project browser checks, an explicitly requested Doubao checklist, and a separate local MCP repair workflow. Latest implementation, deployment, and evidence scopes are in [Delivery status](../DELIVERY_STATUS.md).

## Project title

Ming

## Tagline

Every “done” comes with proof.

## Short description

Ming turns requirements into reviewed browser checks, shows what actually failed, and gives your coding AI evidence to fix it. Bring back the updated app and recheck the same standard.

## Technology tags

Use the platform's closest available tags; these are product technologies, not invented event categories.

- IBM Bob
- TypeScript
- React
- Node.js
- Playwright
- Model Context Protocol (MCP)
- Doubao Seed 2.0 Pro, if available

## Category suggestions

- Developer tools
- Software testing
- AI-assisted development
- Workflow automation

## Form values and readiness

| Field | Value / readiness |
| --- | --- |
| Long Description | Copy only the statement body from [problem-solution.md](problem-solution.md): **386 words**, maximum 500. |
| IBM Bob Usage Statement | Copy only the statement body from [bob-usage.md](bob-usage.md): **353 words**, maximum 500. |
| Public Code Repository | [Ming repository](https://github.com/Ming-Amos/Ming) — currently **private**. It is a review link, not yet a public submission link. Existing permission to upload source does not establish permission to change visibility. |
| Demo Application Platform | Browser web application built with React and TypeScript. Static-project checks execute in the visitor's browser; a server-side Doubao integration proposes checklists. The optional local companion uses Node.js, Playwright, and MCP. |
| Application URL | [Ming preview](https://ming-acceptance-proof.amosming.chatgpt.site) — currently **owner-private**. The deployed app runs static-project checks and a live sample; Evidence Studio separately replays recorded proof. Judge access must be verified before submission. |
| Bob task summaries | Original screenshots in [bob_sessions](../../bob_sessions/README.md), including completed Stage A/B and the interrupted Stage C task. The separate connected-tools screenshot proves registration only. |
| Cover image | [ming-cover.png](../../submission/ming-cover.png) — concept artwork, not execution evidence. |
| Video | [ming-demo-own-voice.mp4](../../submission/ming-demo-own-voice.mp4) and [English subtitles](../../submission/ming-demo-own-voice.srt) — authorized synthetic owner-voice narration over the same **172-second** picture timeline, including 122 seconds of actual app operation. Current guided UI, one genuine ten-step model draft, real failure, copied repair instructions, and prepared corrected source passing the same plan. See [narration edition and media status](own-voice-video-notes.md). The [previous 172-second narration edition](../../submission/ming-demo.mp4) and [164-second prototype](../../submission/archive/ming-demo-prototype.mp4) remain unchanged. |
| Slide presentation | Completed: [editable PowerPoint](../../submission/ming-slides.pptx) and [matching PDF](../../submission/ming-slides.pdf), eight English slides covering the current workflow, genuine hosted model evidence, repair handoff, and Bob attribution. [Current speaker notes and sources](deck-notes.md); [archived prototype notes](archive/deck-notes-prototype.md). |

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
| [Current narrated video](own-voice-video-notes.md), [original recording notes](video-notes.md), and [recording metadata](../evidence/current-video/2026-09-27/recording.json) | The current compiled guided UI made one genuine Seed 2.0 Pro request: **ten steps**, 965 input and 566 output tokens. The real buggy upload failed persistence; prepared corrected source passed the unchanged plan, with original failure evidence preserved. The recording contains 122 seconds of actual application operation. The owner-voice edition changes narration and captions only. | This take runs the current app locally, not on the production domain. It does not show an AI editing source, ZIP/GitHub import, or complete application coverage. The new narration is not an additional model-planning or acceptance run. |
| [Hosted Shipboard model verification](../PLANNER_FORMAT_INCIDENT.md) | One real Seed 2.0 Pro request generated **nine steps** for empty-input validation, task creation, and persistence. The buggy upload failed after reload; the prepared corrected upload passed the unchanged plan. Production verification: **15/15**. | The model did not repair the source. Nine steps are not nine separate features. This recording predates the latest simplified interface. |
| [Local Shipboard MCP repair](../judge-evidence/README.md) | A coding assistant used actual stdio MCP, changed the same target's persistence code, and reran its unchanged **three-criterion, hand-authored plan**. All three criteria passed with `verifiedRepair: true`; original evidence was preserved. | This plan was not generated by Doubao, and Bob did not perform this later repair. |
| [Guided-workflow review](../SIMPLE_WORKFLOW_REVIEW.md) | Latest desktop/mobile flow passed **31/31** behavioral checks plus **7/7** final-copy checks. A real Field Notes app failed persistence, then revised files passed the same **five-step** plan. Stale/unresolved drafts, cancellation, duplicate approval, and manual authoring were checked. | Provider responses were explicit local fixtures; displayed fixture token counts are not actual model usage. This suite is not an additional live-model demonstration. |

A local running URL's successful rerun may be acceptance evidence while `verifiedRepair` remains false. Stronger source-bound repair verification needs captured source and matching plan, runner, and target identities; a source-directory hash alone does not prove what a running server executed.

Preserve original Bob summaries and both older evidence bundles. Attribute the initial core and repair/MCP foundations to Bob. Identify later implementation, hosted integration, interface changes, and the recorded source repair as subsequent development with additional tools. Do not add unmeasured time savings or general model-quality claims.

## Remaining before submission

- Obtain the necessary visibility authorization, make submission links accessible as intended, and test them without the owner's session. Repository and site remain private at this checkpoint.
- Confirm that the current account setup satisfies the organizer's stated conditions. A successful personal-trial login does not by itself establish eligibility.
- Review the actual event form and attach the correct statements, original Bob summaries, repository, application link, cover, video, and slides. Nothing in this package has been submitted automatically.
