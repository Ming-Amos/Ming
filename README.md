# Ming

**Every “done” comes with proof.**  
每一句「已完成」，都有据可验。

Ming checks features built with AI against a standard you review. Connect your development app, save its requirements, edit and confirm an acceptance plan, then run real browser checks. Failed checks include observations and screenshots that a coding agent can use to fix the app and rerun the same standard.

## Start locally

Validated environment: **Node.js 24.14.0 / pnpm 11.2.2**.

```text
pnpm install
pnpm --filter @ming/runner exec playwright install chromium
pnpm build
pnpm start
```

Open **http://127.0.0.1:4001**. On Windows, after the first installation/build, double-click **`scripts/Start-Ming.cmd`** instead. The launcher reuses a healthy local Ming service, opens the browser, and does not close unrelated applications. Startup does not call a model.

For frontend development, run the backend and `pnpm --filter @ming/web dev --port 4000 --host 127.0.0.1`. Rebuild before using the normal launcher to see UI changes.

## Use your own project

1. Start your development app, then choose **接入你的项目** in Ming. Register its local URL, or a self-contained HTML file. Optionally associate its source folder so the coding agent can locate the application.
2. Save your PRD or feature requirements. Saved projects, requirements, plan revisions and confirmations survive restarts.
3. Create a plan manually, or configure a compatible model to generate a draft. Review each criterion, boundary case, locator and expected result before confirming. An edited generated plan is recorded as a manual revision.
4. Run the confirmed plan. The workspace shows real progress, expected versus observed behavior and captured browser evidence. You can cancel; cancellation stops remaining work but does not undo clicks or data changes already performed.
5. Create a repair task for a failure. A connected coding agent retrieves and claims it, edits the application's source, and reruns the original plan. The webpage does not automatically wake an editor.
6. Use history and repair comparison to inspect outcomes. Export a completed run as JSON, Markdown or a standalone HTML report with selected original screenshots.

Changing the requirement or revising a plan requires a new confirmation. Old records remain history, rather than silently becoming approval for a different standard.

The plan editor supports **15 actions/assertions**: navigation, fill, click, reload, option selection, check/uncheck, visible/scoped-visible/absent text, element count, enabled/disabled input, input value and URL checks. Use accessible labels or explicit `css=` selectors. These are browser acceptance checks; they are not arbitrary code execution.

## Supported targets

| Target | What works | Evidence boundary |
| --- | --- | --- |
| Running local app | Multi-file frontend served from `http://localhost:1024–65535` or `http://127.0.0.1:1024–65535`; Ming's own ports are excluded | Observes the running app. A source-folder hash does not prove the server executed those exact source bytes. |
| Self-contained HTML | A local `.html` / `.htm` file containing its own scripts and styles | Executes a captured file snapshot, including reloads; eligible for the stricter source-bound repair comparison. |

For a running app, page navigation, scripts and API requests must stay on the **same origin**. HTTP redirects and cross-origin requests are blocked. If your backend uses another port, expose it through the frontend development server's proxy. Local HTTPS, public websites, arbitrary remote services, mini programs, CAPTCHA and automatic login setup are outside the current supported workflow.

The optional source folder helps the agent locate code and records a bounded source fingerprint. Ming does not edit it automatically. Passing the registered criteria does not prove that every feature is correct. A live URL passing its rerun is acceptance evidence; it must not be described as a verified frozen-source repair.

## Model settings and costs

Open **模型设置** to save an OpenAI-compatible Chat Completions API root, model ID and API key. The adapter appends `/chat/completions`; include the provider's required version prefix in the root.

- Saving activates local settings without a restart and makes **no model call**.
- The password field never reads a saved key back. Leave it blank to retain the existing key, replace it by entering a new one, or use **删除本地配置与密钥**.
- Settings are stored in the ignored local `runtime/provider-config.json`. Existing `PROVIDER_*` environment configuration takes precedence and is explicitly shown; the UI will not silently override it.
- **测试连接** sends one real request, with up to 8 requested output tokens and a 10-second deadline. It may incur provider charges. Plan generation is a separate explicit request.
- The interface records actual returned token counts for the latest 200 calls and marks missing usage. It does not invent prices or silently fall back to sample plans.

No provider key has been supplied and no external live model has been quality-tested. Manual plans and sample runs need no model API or Bobcoins. Your coding agent's own analysis and edits use its separate service/account.

## Connect a coding agent

Open **让编码 AI 调用 Ming** and copy its local MCP configuration and English workflow instruction. The adapter offers **12 tools** for project discovery, confirmed acceptance, progress, cancellation, evidence, repair and comparison.

See [AI connection and full workflow](docs/AI_CONNECTION.md). The default API is `http://127.0.0.1:4001`; `MING_BASE_URL` can point the adapter to another local HTTP origin. Update the absolute adapter path when moving the repository. Bob can use [the existing project configuration](.bob/mcp.json).

## Samples and recorded proof

The daily-report and independent Focus todo samples include normal and deliberately defective variants. Their plans are hand-authored fixtures, clearly distinguished from manual user plans and live model output.

The [reviewed evidence bundle](docs/demo-evidence/README.md) preserves a real earlier repair: **Codex used stdio MCP, changed the same daily-report target's source, and reran the unchanged plan**. The persistence failure became a pass, all three criteria passed, and the recorded comparison returned `verifiedRepair: true`. The original buggy variant remains defective for repeatable demonstrations. [Record IDs and hashes](docs/demo-evidence/manifest.json) identify that checkpoint; they are not new-interface test results.

## Validation and delivery

Current checks passed: **13 provider**, **36 backend integration**, **13 runner**, **16 actual-SDK MCP/report**, **32 updated-product browser UI**, and **27 compiled read-only viewer checks**. The full typecheck and build passed. Provider settings also passed a real-browser save/test/reopen/delete/read-only smoke check using a local mock server. These checks made no commercial model calls. See [DELIVERY_STATUS](docs/DELIVERY_STATUS.md) and [product UI review](docs/PRODUCT_UI_REVIEW.md) for their scopes and reports.

```text
pnpm typecheck
pnpm build
pnpm --filter @ming/server exec ts-node src/provider/provider-settings.test.ts
node apps/web/src/components/ProviderSettings.smoke.mjs
node scripts/review-product-runner.mjs
node scripts/review-real-targets.mjs
```

IBM Bob built the initial runner, evidence/history, provider, plan validation/confirmation and repair/MCP foundations. After its trial quota ended, the user authorized **Codex** to complete and extend the application, including the new project workflow and model settings. [Original Bob session summaries](bob_sessions/README.md) remain unchanged; Codex's work and the recorded source repair are not attributed to Bob.

The [GitHub repository](https://github.com/Ming-Amos/Ming) and [Sites preview](https://ming-acceptance-proof.amosming.chatgpt.site) remain **private, pending user approval to publish**. Sites serves a read-only selection of reviewed historical evidence, not a remotely controlled development environment. Local runtime settings and keys are excluded.

[The 164-second video](submission/ming-demo.mp4), [five-slide deck](submission/ming-slides.pdf), and existing interface screenshots show the **previous prototype checkpoint**, not all features in the updated UI. [Submission statements](docs/submission/fields.md), [concept cover](submission/ming-cover.png), and [delivery checklist](docs/DELIVERY_STATUS.md) are available for final review. The cover is artwork, not execution evidence. The project has not been submitted automatically; account eligibility remains subject to organizer confirmation.
