# Uploaded static projects

The `/#upload` workspace executes a visitor's own HTML or static ZIP in that visitor's browser. This is separate from the bundled guided sample and the original recorded Evidence Studio. The pixel-art welcome page is preserved; **Start** enters this workflow.

## Workflow

1. Choose one self-contained HTML file or a ZIP of built static output. For a frontend source repository, build it first and ZIP the generated `dist` or `build` directory. The online preview does not install packages or start servers.
2. Select an entry HTML page. Review the real page and the discovered element selectors.
3. Paste requirements or import Markdown/plain text. Define each action and expected assertion. Requirements alone do not generate executable checks in this workflow.
4. Confirm the project, requirements and steps. Changing any of them invalidates confirmation.
5. Run checks. The runtime opens a fresh isolated session, performs the specified operations, observes the page, records each step and stops at a failure. Cancelled or unfinished steps remain unchecked.
6. Inspect expected/observed values and DOM snapshots. Export the report before closing the page, or copy the repair brief into a coding assistant.
7. Upload a revised file, restore the original plan if necessary, confirm and rerun. Comparison identifies matching plans and entry pages, changed source fingerprints and the actual new outcome. It retains the original run rather than overwriting it.

## Supported inputs and operations

- HTML/HTM and static ZIP; local CSS/JS/MJS/JSON, images and fonts. Nested build folders and supported local relative assets are resolved into the isolated document.
- Acyclic relative ES modules are bundled as data URLs. Bare imports, import maps, `import.meta`, cycles and nonliteral dynamic imports need a compatible static build first.
- Up to 10 MB input, 20 MB unpacked, 100 files. ZIP central and local metadata, paths, file types, encryption, checksums and expansion limits are checked before execution.
- Actions: click, fill, select option, check, uncheck, reload. Assertions: visible text contains, exact element count, exact input/select/textarea value. Plans have 1–30 steps and at least one assertion.
- Count checks include matching hidden elements. Other targeted steps require a unique selector. Text matching uses the visible element's inner text; value matching uses form control values.

## Execution and evidence boundaries

The imported document uses an opaque sandbox origin, blocked network connections and restricted resource policies. The parent communicates through a private MessageChannel. Uploaded code cannot read Ming's DOM, cookies or storage. Files are processed in page memory without a server upload or model call.

Application local/session storage uses a bounded in-memory adapter (100 keys and about 128 KiB per store), retained only across reconstructed page reloads within the same run. Each run starts fresh. Cookies, IndexedDB, backend services, remote dependencies, external navigation and native browser authentication are unsupported. This is a browser preview, not an operating-system resource sandbox or a tamper-proof certification service; use projects whose code you trust. Synchronous runaway scripts can still affect browser responsiveness.

Captures are browser-rendered images of the observed DOM, with computed styles, form values and supported embedded assets. They are not native browser screenshots. They capture up to the first 1200 vertical pixels and a maximum 1280-pixel width; complex CSS, pseudo-elements, video, web fonts or scrolling containers may differ. Capture failures are recorded explicitly. They do not change an assertion into a pass.

The last six runs live in memory; the original baseline remains separately preserved. Export includes the current run, baseline, follow-up and comparison metadata. Source and plan hashes describe the imported bytes and chosen standard. A passing revised upload shows that those checks passed; it does not prove complete product correctness, who made the repair, or an autonomous AI repair.

## Full local workflow

Use `/#studio` with the local Ming service for running applications, 15 action/assertion types, native Playwright screenshots, persistent history, optional model-generated draft plans and MCP repair tasks. The hosted upload path does not expose a remote coding service. Neither Bob nor a model API is invoked by importing, previewing, manually checking, comparing or exporting a static project.

## Verified release

On 2026-09-26 the compiled own-project UI passed 47 checks over 10 runs. The deployed private site passed 19 checks over three fresh HTML/ZIP runs, including a genuine failed persistence assertion and a revised source passing the unchanged standard. See [local browser report](evidence/upload-studio/2026-09-26T15-08-23-466Z-4a6f15e1/report.json) and [production report](evidence/upload-studio/production-report.json). The hosted frontend is `index-BIIGKyJP.js` from application commit `5089743f41d9b2cd5dfc05d3c6b893badb6c92f4`; later documentation/test-harness changes record that exact deployment.
