# Optional Doubao acceptance drafts

Ming's own-project workspace supports **Doubao Seed 2.0 Pro**, model `doubao-seed-2-0-pro-260215`, through Volcengine Ark's compatible chat API. The same guided review and approval workflow is available for HTML, static ZIP and public GitHub imports.

## Use it

1. **Add app:** import a supported project. Ming opens its preview and advances to the description.
2. **Describe:** enter requirements and expected outcomes, then choose **Create my checklist**. Only this explicit action calls the model; its cost and data disclosure appear beside it.
3. **Review:** read one checklist. **Ming will** describes the actions and **Passes when** states the expected results. Unresolved questions or a stale draft block approval. Edit the description and generate again, or explicitly discard the draft and use manual authoring under **Advanced options**.
4. Choose **Approve and check**. This single action approves exactly the displayed checklist and executes its browser operations. The model does not decide which checks passed. Optional **Edit these steps myself** and **Edit technical steps** expose manual configuration before approval.
5. **Results:** inspect the outcomes and captures. **Copy instructions for my AI** prepares a repair handoff; **Check an updated app** opens the revised-file import. Review and approve the same checks again to compare results.

Opening the app, importing files, editing requirements, approving a checklist, checking a project, comparing runs and exporting reports do not call a model. A pending draft blocks accidentally running an older plan; an invalid draft never falls back silently. Each execution requires a fresh **Approve and check** action on the current review screen.

## Configuration and cost

- The hosted server reads `MING_DOUBAO_API_KEY` as a Sites runtime secret and `MING_DOUBAO_MODEL` as its model setting. Keys are never included in frontend assets, source archives or API status responses.
- The local server uses its existing provider settings. Configure `https://ark.cn-beijing.volces.com/api/v3`, the model ID above, and the key in the local settings form. The ignored `runtime/provider-config.json` file stays local. An environment override, if present, takes precedence as described by the provider settings.
- Drafts use one non-streaming request with strict JSON Schema structured output, a maximum of 4096 output tokens, reasoning disabled, a 60-second timeout and no automatic retry. Provider charges apply to generated drafts, independently of Bobcoins.
- The UI and exported plan origin show provider-reported input/output token counts. Missing counts remain unknown. The upload-planner counts are attached to their drafts/runs; they are not currently added to the separate local Evidence Studio usage ledger.
- A failed or cancelled call may have incurred provider cost. Manual planning remains available. The endpoint limits requests to six per minute per edge IP within a Worker instance; this is a bounded throttle, not a durable spending budget.

## Data and evidence

The request contains requirements, project name, entry path and up to 80 observed page elements. These can include visible page text. It does not upload repository source files, arbitrary local folders, screenshots or GitHub credentials. It goes through Ming's server to the fixed official Ark endpoint; the browser never receives the API key.

Generated output is treated as an untrusted draft, validated against the supported browser-action schema, and never executed as JavaScript or shell commands. Both the provider's closed JSON Schema and Ming's independent parser/validator must accept it. Ming does not guess-repair malformed JSON, remove unsupported actions, or execute a partial response. Drafts may still miss a requirement or choose an unsuitable selector: the review step is part of the product. Each run preserves its plan origin and source identity. A passing result proves only that the confirmed checks passed on that imported snapshot.

If generation fails, the workspace preserves the project, requirements, current plan and previous evidence. **Details for troubleshooting** contains provider-reported usage (or Unknown), diagnostics and a copy button. **Try again** is explicit; no retry is made automatically. Error diagnostics contain only status, fixed error codes and numeric usage, without project content or the provider key.

Model and API references: [Volcengine model list](https://docs.volcengine.com/docs/ark/model-list?lang=zh), [chat API](https://docs.volcengine.com/docs/ark/chat-api?lang=zh&redirect=1).

## Live verification

On 2026-09-26 UTC, the existing private site completed a real Seed 2.0 Pro generation/review/confirmation/browser-run sequence. The model proposed initial count 0, one Increment click, and expected count 1. The actual isolated browser executed all three steps successfully with DOM captures and exported provenance. The generation reported 489 input and 163 output tokens. [Production report](evidence/github-doubao/production-report.json). This verifies one concrete workflow; other requirements still need review and may produce a rejected or incomplete draft.
