# Ming acceptance feedback
Project: index
Source fingerprint: fe5fff4fc84cd5b5d180867e830c32c9c2e1bfbd736aa24ab71faa00c7217ff1
Plan fingerprint: 1014f248b2ea23b3acab23e0a48e11121b2179179b5f83f1641a282ba5f39ba8
Run: fba67000-1651-43d9-89ef-fdc7e15fd681 (failed)
Requirement: 1. Submit an empty task name. Show "Add a task name before continuing." and keep the count at "0 tasks".
2. Add a task named "Ming final review". It must appear in the task list.
3. Reload the application. "Ming final review" must still appear in the task list.

Observed in an isolated browser DOM check. Storage uses a session adapter; captures are DOM renders. No AI repair has been performed.

Verify there is still 1 task in the task list after reload [failed]
Action: assertCount
Target: #taskList > li
Value: 1
Expected: 1 matching elements
Observed: 0 matching elements

Verify the 'Ming final review' task still appears in the task list after reload [unchecked]
Action: assertText
Target: #taskList > li
Value: Ming final review
Expected: Ming final review
Observed: Not checked

Fix the uploaded source against these requirements, then rerun the same confirmed plan. Do not change assertions to hide failures.