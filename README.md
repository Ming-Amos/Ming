# Ming

**Every “done” comes with proof.**  
每一句「已完成」，都有据可验。

Ming helps developers verify features built with AI. Review an acceptance plan, run it in a real browser, inspect the failure evidence, and hand the issue to a coding agent. After the agent edits the application, rerun the same standard and compare the evidence.

The **Application X-ray** workspace connects requirements, actual browser screenshots, expected versus observed behavior, and the repair handoff. It does not invent network traces or assume that creating a task automatically wakes an AI editor.

## What is verified

The local core has completed a real repair cycle. Codex used the actual stdio MCP tools to retrieve and claim a failed daily-report acceptance task, changed the **same target's source**, and reran the unchanged plan. The persistence criterion changed from failed to passed; all three rerun criteria passed. The comparison retained matching plan, runner, and target identities while the target source fingerprint changed.

| Real browser demonstration | Recorded outcome |
| --- | --- |
| Daily-report normal sample | 3 / 3 criteria passed |
| Daily-report deliberately defective sample | Persistence criterion AC-02 failed |
| Independent Focus todo normal sample | 3 / 3 criteria passed |
| Focus todo deliberately defective sample | Completion-state persistence criterion TODO-03 failed |
| Daily-report repair workspace, after actual source edit | 3 / 3 criteria passed; `verifiedRepair: true` |

See the [reviewed evidence and source diff](docs/demo-evidence/README.md) and [manifest with record IDs and file hashes](docs/demo-evidence/manifest.json). These runs use **hand-authored fixture plans** and intentionally seeded defects. They are not live model-generation results or unknown production incidents.

The final interface passed 43 integration checks, and the read-only viewer passed 10 browser checks. A 164-second narrated demonstration is available below. Publication status is tracked in [DELIVERY_STATUS](docs/DELIVERY_STATUS.md). The model adapter is implemented but no external provider has been configured or quality-tested.

## Start locally

Validated development environment: **Node.js 24.14.0** and **pnpm 11.2.2**. The repository pins pnpm in `package.json` and includes its lockfile.

From the project folder, install and build once:

```text
pnpm install
pnpm --filter @ming/runner exec playwright install chromium
pnpm build
```

Then either double-click **`scripts/Start-Ming.cmd`** on Windows, or run:

```text
pnpm start
```

Open **http://127.0.0.1:4001**. The built interface and API use the same local service; a separate frontend server is unnecessary. The Windows launcher opens the browser and runs the service in the background. It reuses a healthy existing Ming service and does not close other programs. Starting Ming does not invoke a model.

For interface development, run the local backend and `pnpm --filter @ming/web dev --port 4000 --host 127.0.0.1`. Rebuild the frontend before using the normal launcher to see those changes.

## Try the workflow

1. Select a sample project and inspect its acceptance criteria, prerequisites, and planned browser steps.
2. Confirm the standard and start an acceptance run. Fixture runs require no model API or Bobcoins.
3. Select a failed criterion to inspect its actual observations and original screenshot. Not every step has an individual screenshot; the interface identifies the evidence it displays.
4. Create a repair task and give its English handoff instruction to a coding agent connected to Ming's MCP adapter.
5. The agent reads and claims the task, edits the target application, and starts a rerun with the expected source fingerprint. Ming compares the actual results against the original standard.

The preserved `buggy` sample remains defective so failure detection can be demonstrated repeatedly. `repair-demo` contains the completed, in-place repair; its original failure and source diff remain in the evidence bundle. Do not switch from a defective target to the normal sample and describe that as a repair.

## Sample targets and scope

Targets are registered in [`fixtures/targets.json`](fixtures/targets.json). Business-specific requirements and selectors belong to each plan, not to the generic browser runner.

| Target | Local route | Plan |
| --- | --- | --- |
| `normal` | `/normal` | Daily-report fixture |
| `buggy` | `/buggy` | Daily-report fixture |
| `repair-demo` | `/repair-demo` | Daily-report fixture |
| `todo-normal` | `/todo-normal` | Focus todo fixture |
| `todo-buggy` | `/todo-buggy` | Focus todo fixture |

The current binding guarantee covers **registered, self-contained HTML documents**: every browser context executes the captured document, including reloads. It does not freeze external assets, backend state, or remote applications. Multi-file apps, authentication, and external services need additional integration. Passing registered criteria does not prove an entire application is defect-free.

## Coding-agent connection

Build `apps/mcp` as part of `pnpm build`. The stdio adapter provides five tools:

- `ming_get_failed_run`
- `ming_get_repair_task`
- `ming_claim_repair_task`
- `ming_rerun_plan`
- `ming_get_comparison`

[The Bob MCP configuration](.bob/mcp.json) contains the original Windows workspace paths. On another machine, change its Node executable, adapter path, and working directory to your local absolute paths. The adapter currently connects to **127.0.0.1:4001**, so keep the backend on that port when using MCP.

The coding agent calls Ming. The web interface queues evidence and displays state; it does not remotely control an arbitrary editor. Bob's actual tool-discovery screenshot and Codex's subsequent real MCP repair are documented separately.

## Optional model provider

The server implements **OpenAI-compatible Chat Completions**. To use a compatible provider, configure `PROVIDER_LABEL`, `PROVIDER_BASE_URL`, `PROVIDER_MODEL_ID`, and `PROVIDER_API_KEY` in the ignored local file **`apps/server/.env`**, using [`.env.example`](.env.example) as the field reference, then restart the service. Preserve any existing configuration. The base URL includes the provider's API-version prefix; the adapter appends `/chat/completions`.

Other protocols require an additional adapter. Keys stay on the server and must not appear in browser code, screenshots, or the public repository. The adapter does not silently replace a failed model call with a fixture. A real provider still needs end-to-end generation, human review, and browser validation; compatibility or model quality is not established by the local simulated-response tests.

## Public evidence viewer

The prepared public viewer is **read-only history exploration**. It serves reviewed real records, screenshots, and the recorded repair comparison. It cannot execute new browser checks, call a model, or repair source code. Those actions require the local application.

The [deployed Sites preview](https://ming-acceptance-proof.amosming.chatgpt.site) is currently owner-private. It is not yet a public judging URL. The Sites adapter and packaging instructions are in [`scripts/public-demo/README.md`](scripts/public-demo/README.md). Only the explicitly selected `docs/demo-evidence` bundle is packaged; live local runtime data and credentials are excluded.

## Contributions and validation

IBM Bob implemented the initial browser runner, evidence/history workflow, provider adapter, plan validation and confirmation, and repair/MCP foundations. After its trial quota ended, the user authorized Codex to finish the integrity checks, final interface, second sample, and delivery work. **Codex performed the recorded target repair.** These contributions are not attributed to Bob.

Genuine Bob task summaries are in [`bob_sessions`](bob_sessions/README.md). Historical Stage A/B reports describe their respective checkpoints, rather than the final interface. Current core verification includes the snapshot/repair-integrity tests, API origin-boundary tests, and public-adapter tests. For local validation:

```text
pnpm typecheck
pnpm build
node scripts/review-repair-integrity.mjs
node scripts/review-repair-integrity-origin.mjs
node --test scripts/public-demo/worker.test.mjs
```

These checks do not consume Bobcoins or call a real model. Test fixtures and adversarial verification records are separate from the selected demonstration evidence.

## Delivery materials

- [Problem & Solution Statement](docs/submission/problem-solution.md)
- [IBM Bob Usage Statement](docs/submission/bob-usage.md)
- [Submission fields](docs/submission/fields.md)
- [Five-slide PDF](submission/ming-slides.pdf)
- [Narrated MP4 demonstration](submission/ming-demo.mp4) — 164 seconds, with English captions
- [English subtitles](submission/ming-demo.srt)
- [Concept cover](submission/ming-cover.png) — illustration, not a product screenshot
- [Delivery checklist](docs/DELIVERY_STATUS.md)
- [Original product requirements](docs/MING_PRD.md)

Event: [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon). Participation-account eligibility remains subject to the organizer's confirmation; the saved implementation evidence alone does not establish eligibility.
