# Optional Doubao acceptance drafts

Ming's own-project workspace supports **Doubao Seed 2.0 Pro**, model `doubao-seed-2-0-pro-260215`, through Volcengine Ark's compatible chat API. The same review/apply/confirm workflow is available for HTML, static ZIP and public GitHub imports.

## Use it

1. Import a project and wait for its actual page elements to appear.
2. Enter explicit requirements and expected outcomes.
3. Choose **Generate draft with Doubao**, or **Create my checklist** in an empty plan. Both buttons invoke the same explicit draft-generation action. Only requesting a draft calls the model.
4. Review the proposed steps and unresolved questions. Clarify requirements and regenerate if needed, or discard the draft and write a manual plan. An unresolved or stale draft cannot be applied.
5. Review the plain-language cards: **Ming will** describes the actions and **Passes when** states the expected results. Choose **Use this checklist**, then confirm **These checks match my requirements.** The optional **Edit technical steps** disclosure contains the original selector/action editor. Editing a step updates the cards and requires confirmation again.
6. Run acceptance checks. Ming executes browser operations, collects actual observations and creates DOM-rendered snapshots. The model does not decide which checks passed.

Opening the app, importing files, editing requirements, applying a draft, checking a project, comparing runs and exporting reports do not call a model. A pending draft also blocks accidentally running an older plan until it is applied or discarded. Changing the project, entry, requirements or steps requires renewed confirmation.

## Configuration and cost

- The hosted server reads `MING_DOUBAO_API_KEY` as a Sites runtime secret and `MING_DOUBAO_MODEL` as its model setting. Keys are never included in frontend assets, source archives or API status responses.
- The local server uses its existing provider settings. Configure `https://ark.cn-beijing.volces.com/api/v3`, the model ID above, and the key in the local settings form. The ignored `runtime/provider-config.json` file stays local. An environment override, if present, takes precedence as described by the provider settings.
- Drafts use one non-streaming request with strict JSON Schema structured output, a maximum of 4096 output tokens, reasoning disabled, a 60-second timeout and no automatic retry. Provider charges apply to generated drafts, independently of Bobcoins.
- The UI and exported plan origin show provider-reported input/output token counts. Missing counts remain unknown. The upload-planner counts are attached to their drafts/runs; they are not currently added to the separate local Evidence Studio usage ledger.
- A failed or cancelled call may have incurred provider cost. Manual planning remains available. The endpoint limits requests to six per minute per edge IP within a Worker instance; this is a bounded throttle, not a durable spending budget.

## Data and evidence

The request contains requirements, project name, entry path and up to 80 observed page elements. These can include visible page text. It does not upload repository source files, arbitrary local folders, screenshots or GitHub credentials. It goes through Ming's server to the fixed official Ark endpoint; the browser never receives the API key.

Generated output is treated as an untrusted draft, validated against the supported browser-action schema, and never executed as JavaScript or shell commands. Both the provider's closed JSON Schema and Ming's independent parser/validator must accept it. Ming does not guess-repair malformed JSON, remove unsupported actions, or execute a partial response. Drafts may still miss a requirement or choose an unsuitable selector: the review step is part of the product. Each run preserves its plan origin and source identity. A passing result proves only that the confirmed checks passed on that imported snapshot.

If generation fails, the workspace preserves the project, requirements, current plan, confirmation and previous evidence. The failure card displays provider-reported usage (or Unknown), expandable diagnostics and a copy button. No retry is made automatically. Error diagnostics contain only status, fixed error codes and numeric usage, without project content or the provider key.

Model and API references: [Volcengine model list](https://docs.volcengine.com/docs/ark/model-list?lang=zh), [chat API](https://docs.volcengine.com/docs/ark/chat-api?lang=zh&redirect=1).

## Live verification

On 2026-09-26 UTC, the existing private site completed a real Seed 2.0 Pro generation/review/confirmation/browser-run sequence. The model proposed initial count 0, one Increment click, and expected count 1. The actual isolated browser executed all three steps successfully with DOM captures and exported provenance. The generation reported 489 input and 163 output tokens. [Production report](evidence/github-doubao/production-report.json). This verifies one concrete workflow; other requirements still need review and may produce a rejected or incomplete draft.
