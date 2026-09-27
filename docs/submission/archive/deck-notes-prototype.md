# Ming submission deck

Deliverable: `submission/ming-slides.pdf` - five English pages, 16:9 (960 x 540 points). This PDF is a static slide presentation. The reproducible source is `scripts/build-submission-deck.py`; it does not produce an editable PowerPoint file.

## Speaker notes and evidence

1. **Ming.** Automatic acceptance for features built with AI. The existing `submission/ming-cover.png` is conceptual artwork, labelled as a concept cover on the slide. It is not a capture of the functioning application.
2. **The work left after "done".** Explain the manual loop: open the page, inspect each case, record the failure, report it to the agent, then repeat after editing. Ming requires the user to review the acceptance plan before running it. A failure becomes evidence a coding agent can retrieve through MCP; a repair still needs that agent to claim and perform the work. The web page does not independently wake up or control an arbitrary AI editor.
3. **A repair with the same acceptance plan.** These are actual browser screenshots from the same logical repair target. The baseline lost the report after refreshing. Codex retrieved and claimed its repair task through actual stdio MCP, edited the target source, and reran the unchanged plan. AC-02 passed; all three rerun criteria passed. The comparison records matching known plan and runner fingerprints, changed source content, matching target identity, and `verifiedRepair: true`. Full screenshot files are embedded without crops, annotations or pixel edits.
4. **Built with IBM Bob.** The complete original Stage B task-summary screenshot remains visible. Bob implemented the initial real browser runner, evidence/history, provider adapter, plan confirmation, and repair/MCP foundations. Codex completed subsequent integrity checks, interface and second-sample work, and performed the recorded repair after Bob's trial quota ended. The slide does not imply Bob performed that later repair. Full task evidence is in `bob_sessions/`.
5. **Prototype scope.** Two independently marked-up self-contained sample applications share the generic runner with separate acceptance plans. Local mode supports the full workflow. The public evidence mode is read-only and shows saved real runs. The model interface accepts compatible provider configuration, but this demonstration uses hand-authored fixtures; no live model invocation is claimed. Current snapshot guarantees cover the self-contained HTML document, not arbitrary remote applications, external assets or backend state.

## Exact source references

- Authoritative evidence manifest: `docs/demo-evidence/manifest.json`.
- Baseline run: `65aece9c-b145-4045-8096-60331a4c6ae1`.
- Repair task: `7ed27f84-aa14-43f8-90e2-f84702dc21b0`.
- Rerun: `2cf3cc33-507f-41c2-8b9f-6a16c712a7ae`.
- Before image: `docs/demo-evidence/runtime/screenshots/65aece9c-b145-4045-8096-60331a4c6ae1_AC-02-S2_failed.png`.
- After image: `docs/demo-evidence/runtime/screenshots/2cf3cc33-507f-41c2-8b9f-6a16c712a7ae_AC-02_final.png`.
- Second-project image: `docs/demo-evidence/runtime/screenshots/a35c69f6-cb5c-4293-90df-2a82d96eb067_TODO-03_final.png`.
- Bob image: `bob_sessions/ming_task03_stage_b_final_summary.png`; original task ID `bfa75e6b4e53cc8425e6754a8b69c8f3`.

The builder verifies the three browser image hashes against the manifest before embedding them. It checks the manifest's positive repair comparison and preserves the source image proportions. It asserts the output page count/dimensions and renders every page for visual inspection. No project performance percentage, time-saving claim, live API result or invented evaluation result appears in the deck.

## Review record

Created with ReportLab; parsed with pypdf and rendered with PyMuPDF. The PDF skill operation marker ran successfully once before authoring. Presentation layout and writing guidance informed the design; the requested artifact is PDF, and the unavailable slide artifact runtime was not used.

All five rendered pages were visually reviewed. The final page's spacing was corrected and reviewed again. The original Bob screenshot remains fully visible; fine session text can be inspected by zooming the PDF or opening the source PNG. Render previews and extracted text are private intermediate files under `runtime/submission-deck-qa/` and are not additional submission deliverables.

To rebuild in this Windows workspace:

```powershell
& 'C:/Users/han20/AppData/Local/Python/pythoncore-3.14-64/python.exe' scripts/build-submission-deck.py
```

The script discovers the existing `runtime/media-tools` Python libraries. On another machine, install `reportlab`, `pypdf`, and `pymupdf` in the selected Python environment first. Georgia is used if installed; otherwise the deck falls back to the standard Times font. Reinspect page layouts after a font substitution.
