# Upload plan review — plain-language checklist

This bounded review used the actual Shipboard HTML and replayed the previously saved nine-step provider response locally. No paid model request was made. Screenshots below were captured and inspected during this run.

1. **Enter requirements — healthy.** The uploaded application and the user's three requirements remain visible and unchanged. [Screenshot](01-requirements-desktop.png)
2. **Review the draft — improved.** Three action-and-result cards replace raw selectors. “Use this checklist” describes the user's decision. Technical steps remain available inside a closed disclosure. [Screenshot](02-draft-desktop.png)
3. **Approve the active plan — improved.** The nine executable steps remain intact but appear as three cards. The section is 987 pixels tall, compared with 2,389 pixels before. Only the confirmation and run controls are visible by default; all eight CSS fields are hidden. [Screenshot](03-plan-desktop.png)
4. **Review on mobile — improved.** Text wraps, the 390-pixel page has no horizontal overflow, and the total page height decreases from 4,673 to 3,434 pixels. [Screenshot](04-plan-mobile.png)
5. **Run the checks — healthy.** The browser executes the unchanged saved plan: the first eight steps pass and the ninth exposes the known persistence defect. The failed assertion includes an actual DOM-render capture. The UI revision does not turn failed acceptance into a passing result. [Screenshot](05-real-failure-desktop.png)

The UX harness passed 11 checks, including keyboard opening/closing of technical details, explicit confirmation, unchanged plan export, and no automatic additional draft request. The separate planner regression passed 33 checks, including advanced edits invalidating confirmation and malformed model output preserving the current project, plan, and evidence.

Remaining copy refinements observed in this build:

- The field placeholder is used as its label, producing “Clear \"e.g. Ship the release notes\".” Prefer the actual associated field label when available.
- “The target element” still sounds technical when an element has no human label. Describe the required visible text instead.
- The count produces “\"0 tasks\" is visible and its text includes \"0 tasks\".” Avoid repeating the same visible text as both target and expected value.

Limits: keyboard disclosure and viewport overflow were checked, but this is not a complete screen-reader or contrast audit. Scenario cards summarize the existing execution order; they do not prove that every requirement is covered. The model response is a labelled replay fixture, while the browser operations and failure evidence are real.
