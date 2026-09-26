# Ming online demo: free deployment options

Codex research · 2026-09-26 · Official documentation checked; no account created, credentials supplied, application uploaded or deployment tested.

## Recommendation

**First test a single Render Free Docker web service against Ming's actual memory usage.** It is the closest fit for the existing Express + local Playwright + React architecture. Its small instance and disposable disk are significant constraints, so it is a candidate, not a verified deployment solution. **Cloudflare Workers + Browser Run** is a second genuinely free allowance, but requires runtime/storage changes and provides only ten browser minutes per day. Neither is a promise of unlimited, always-on hosting or free model inference.

**Do not assume Hugging Face Docker Spaces are free for a new personal account.** Current official documentation says creating Gradio/Docker Spaces requires a paid PRO/Team/Enterprise plan. CPU Basic still has no hourly hardware charge (2 vCPU, 16 GB RAM, 50 GB nonpersistent disk), but the plan prerequisite prevents calling the overall solution completely free. Static Spaces remain free and cannot host this backend. The free ZeroGPU exception is for eligible Gradio Spaces, not a way to deploy this Docker application. [HF Spaces overview](https://huggingface.co/docs/hub/spaces-overview#creating-a-new-space)

## Two available free paths

| Requirement | Render Free Docker web service | Cloudflare Workers Free + Browser Run |
| --- | --- | --- |
| Node/Express process | Supported as an ordinary web-service/container process while the instance runs. | Workers use an event-driven runtime, not an indefinitely running Node container. Current code needs adaptation. |
| Chromium | Can package Chromium and its dependencies in Docker. Actual browser launch and stability need verification. | Managed remote browser, controlled through Cloudflare's Playwright fork; replace local Chromium launch. |
| Compute/memory | 0.1 CPU and 512 MB RAM. Chromium plus Node may exceed this; queue one run at a time and measure peak usage. | Worker isolate: 128 MB and 10 ms CPU/request on Free; browser runs separately. Do not mistake 128 MB for a configurable Chromium VM. |
| Browser allowance | No separately stated browser-minute quota; constrained by instance resources and service allowances. | 10 browser minutes/day across the account; at most 3 concurrent browsers. Exhaustion returns 429 until the next UTC day. |
| Runtime continuity | Sleeps after 15 minutes without inbound traffic; about one-minute wake-up. May restart independently. 750 free instance-hours/workspace/month. | Request lifecycle applies. Returning a response does not preserve arbitrary background jobs; `waitUntil` adds at most 30 seconds. Existing in-memory jobs/polling cannot be moved unchanged. |
| Temporary files | Writable, but files created at runtime disappear on sleep, restart or redeploy. Free services cannot attach a persistent disk. | `/tmp` is memory-backed and request-specific; subsequent requests cannot retrieve those files. Runtime JSON/screenshots need a different store or an explicit download flow. |
| Public URL | Assigned `onrender.com` URL with managed HTTPS; no bought domain required. | Assigned `workers.dev` URL; static React assets and controlled sample pages can be served with the Worker. |
| Server-side API key | Runtime environment variables or secret files, outside source/frontend. | Encrypted Worker secret binding, outside frontend assets and public configuration. |
| Credit card | Advertised as no-card signup/deployment; account verification can still request a card. | Official free-account workshop says no credit card needed. Additional products must be checked separately. |

Sources: [Render compute](https://render.com/docs/compute-plans), [Render free limits](https://render.com/docs/free), [Render web services and URL](https://render.com/docs/web-services), [Render Docker support](https://render.com/docs/docker); [Browser Run pricing](https://developers.cloudflare.com/browser-run/pricing/), [browser quota enforcement](https://developers.cloudflare.com/browser-run/limits/), [Cloudflare Playwright](https://developers.cloudflare.com/browser-run/playwright/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers temporary filesystem](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/), [free-account setup](https://developers.cloudflare.com/labs/workers).

Render's no-card statement is in its [official free-tier article](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026); a [Render support response](https://community.render.com/t/the-deployement-of-a-web-service-fails/36005) says additional account verification may request card details. Account eligibility has not been tested. Cloudflare documents the default public URL in [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

## Changes needed for the preferred candidate

These are implementation recommendations, not already completed work:

1. Build one Docker image containing the React build, Express service, Chromium and controlled example apps. Use a browser image/version compatible with the installed Playwright package; the official image includes browsers/system dependencies but not the project dependency itself. Serve frontend/API/examples through one public port. Keep local default binding separate from deployment binding (`0.0.0.0` and provider `PORT`). [Playwright Docker](https://playwright.dev/docs/docker)
2. Run only controlled included targets. Serialize browser jobs, bound time/screenshots, close contexts/browser in all exit paths, and verify repeated normal/buggy runs under a 512 MB container limit before selecting Render. Do not call reduced screenshot capture or lower assertion coverage a successful optimization.
3. Treat online execution history as temporary unless an explicitly selected durable store is added. Keep durable, authentic competition evidence outside the instance; provide downloadable run evidence. Prepackaged historical evidence can survive redeployment as build assets, but must remain labeled historical and separate from new live runs.
4. Configure model keys through service-side secrets only. Render exposes environment values to Docker builds too: never bake a secret build argument into image layers or frontend assets. Do not log keys or place them under frontend `VITE_*` variables. A public app using a private server key still needs bounded model usage; secret storage alone does not limit billable calls. [Render secrets](https://render.com/docs/configure-environment-variables), [Docker secret caveat](https://render.com/docs/docker#environment-variable-translation)
5. Verify public access from a separate browser, cold start after idle, real browser execution, evidence availability, missing-key behavior and model-provider reachability. Keep a clearly explained cold-start state. No tests in this research establish that mainland-China network access or provider access will be reliable.

Cloudflare secrets likewise remain server-side only when application code does not return or bundle them. Use Secret bindings rather than plaintext `vars`. [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Decision boundary

If the actual workload is unstable at Render's limit, do not promise an entirely free full product. Cloudflare is an architectural fallback only if its daily browser quota and migration effort fit the remaining time; it is not a drop-in upgrade. Persistent storage, model API calls and any paid upgrade are separate cost decisions. No purchase or platform choice is made by this document.
