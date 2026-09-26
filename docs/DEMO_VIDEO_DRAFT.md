# Ming demo video draft

Prepared by **Codex (planning and narration draft)**, 2026-09-26. English voice-over with Chinese recording notes. This document is a proposed edit, not evidence that the planned scenes have happened.

**Target cut: 170 seconds (2:50), with 10 seconds of margin; final MP4 must be no longer than 180 seconds.** Plan 135 seconds of real operation from 0:20 to 2:35, including 95 seconds in Ming and 40 seconds in Bob. Count the finished edit: retain at least 90 seconds of actual solution operation, excluding titles, concept art, still-slide explanations and idle waiting.

## Status and recording gates

- **Available:** Stage A real browser execution/evidence/history, and Stage B implementation plus local test-provider review/confirmation/rerun flow. Stage B's recorded UI checks are 39/39 and local HTTP checks 248/248; these are development checks, not a live-provider or user-benefit claim.
- **Pending live verification:** actual external model generation. The current default narration explicitly uses a development plan. Do not call a fixture or local HTTP simulator a live model response.
- **In development, not yet proven:** Stage C MCP connection, Bob reading/claiming a repair task, actual buggy-source repair and comparable successful rerun. The conditional narration below must not be recorded as fact until those exact events are captured.
- **Not implemented:** Stage D's finished application X-ray interface and second-project validation. Use the current working interface. A concept image is not product footage; no formal-visual or cross-project claim is included in this cut.

录制前选择一条完整证据链，记录同一计划、目标、baseline run、repair task 和 rerun 的 ID。如果 Stage C 只验证了 Stage A 夹具，开场确认镜头也用这份夹具；不能把 Stage B 草案剪接成另一份计划的修复结果。明确显示 `fixture` 或 `test transport` 的实际来源。

## 0:00–0:20 — The problem (20 seconds)

**English narration**

> The AI says, “Done.” But I still have to open the app, click through every requirement, capture the failure, and explain it back. After the next change, I do it all again. Ming keeps acceptance checks and the evidence together, so verification can be repeated.

**中文录制指引：** 简短片头，展示“AI 说完成 → 用户点击 → 截图解释 → 修改后再检查”的文字即可。不要用虚构的客户对话、节省百分比或前后耗时。片头不计入真实运行时长。

## 0:20–0:40 — Requirement and confirmation (20 seconds, real Ming operation)

**English narration — default while live generation is unverified**

> The requirement is simple: submitted reports must survive a refresh. I review the acceptance checks and confirm this exact plan. Today’s demo uses a labeled development plan. Live model generation is still awaiting provider configuration and validation.

**中文录制指引：** 展示对应需求/标准、刷新后保留数据这一条及实际确认操作；保留来源标签。使用同一份随后执行的计划，勿录入密钥。如果来源或确认方式与界面不同，先改旁白，不补造界面状态。

**Only after a real provider call is verified, replace the preceding narration with:**

> I enter the requirement: submitted reports must survive a refresh. Ming sends the requirement and bounded page context to the configured model. I review the returned draft and its source references, then confirm this exact plan before any acceptance run starts.

此替代镜头目前待验证。必须真实录到供应商生成、来源与人工确认；模型等待可剪掉并标注时间跳转。不能仅凭 Stage B 本地 HTTP 测试启用这段旁白。

## 0:40–1:10 — A real failure and its evidence (30 seconds, real Ming operation)

**English narration**

> This sample contains a deliberately seeded persistence bug. Ming runs the registered checks in a real browser. Submission works, but the report disappears after refresh. Here are the expected result, the observed failure, and the original screenshot. The failed run stays in history; a later result will not replace it.

**中文录制指引：** 字幕明确“Pre-seeded demo defect”。实际触发运行，展示刷新检查失败，点击期望/观察值和原始截图，再展示历史中的该 run。具体旁白以本次真实结果为准；不用旧成功截图覆盖失败，不把截图本身说成全部断言通过的证明。

## 1:10–1:50 — Bob retrieves the evidence and repairs the source (40 seconds, CONDITIONAL real operation)

**Recording gate: Stage C must first prove actual Bob MCP connection, evidence retrieval, claim and target-source edit. This scene is currently pending.**

**English narration — use only after that gate passes**

> I create a repair task from this failed run. That queues the work; it does not wake Bob. I ask the connected Bob task to handle this task ID. Bob retrieves the failure evidence through Ming’s local MCP tools and claims the task. Here is the actual source change in the same buggy application. We have not switched to the healthy sample or weakened the check.

**中文录制指引：** 先录网页创建 waiting 任务，再切 Bob 的真实 Connected/Tools 和实际工具调用。用户只给 task ID 与一次处理指令，不逐项复制截图/复现步骤。保留调用返回的 baseline/task ID，随后展示 Bob 对同一 buggy 文件的真实 diff。耗时开发可跳切，字幕标注“Time jump — same task”；不用排练文字或 SDK 自测冒充 Bob 调用。

## 1:50–2:35 — Rerun the same checks and compare (45 seconds, CONDITIONAL real Ming operation)

**Recording gate: a linked, comparable rerun must actually finish and support every statement below. This post-repair scene is currently pending.**

**English narration — use only after that gate passes**

> Bob requests a rerun of the same confirmed plan against the same target. The plan and test fingerprints match the baseline. The target’s source fingerprint has changed because the code was repaired. Ming runs every registered check again, including the ones that passed before. This time, persistence passes. I can open both runs and their original evidence side by side. That verifies this repair within the registered scope, not the entire application.

**中文录制指引：** 保留真实 rerun 发起与 run ID，录 Ming 实际进度、最终标准结果和可打开的前后证据。目标身份/地址相同；源码指纹应随真实修复改变，不能要求修复前后源码 hash 相同。计划/测试实现指纹必须可比。网页显示不一致、执行异常、仍失败或未执行时，禁止沿用“persistence passes”。45 秒中用真实结果检查和打开证据填充，不用长等待凑时长。

## 2:35–2:50 — Contribution and limits (15 seconds)

**English narration**

> Bob implemented Ming’s core. Codex supported planning and independent review. This is a local demonstration of registered acceptance checks, not a claim that the whole application is verified. Ming: every “done” comes with proof.

**中文录制指引：** 简短贡献字幕与项目名，使用可追溯的实际代码、Bob 会话和验证记录。若在线地址尚未部署验证，不把 localhost 标为评委可访问地址。正式视觉、第二项目、任意应用适配和未接通的真实模型都不作已完成声明。

## If Stage C is still unverified at recording time

Use the same 170-second schedule, but replace the two conditional scenes. Do not narrate the planned repair as accomplished.

**1:10–1:50 replacement narration**

> The repair handoff is still in development. Bob has already been used to implement Ming’s runner, service, and review flow. These are the actual development changes and checks. What I cannot yet demonstrate is Bob retrieving a repair task through MCP and completing a verified repair. That remains a separate integration milestone.

录真实 Bob 开发记录与对应代码，不伪造运行时工具调用；“MCP repair loop — not yet verified”持续可见。此段不依赖概念图或计划文字来证明产品能力。

**1:50–2:35 replacement narration**

> Here, I rerun the unchanged checks against the same buggy target. The persistence check still fails, and Ming retains both runs and their evidence. This demonstrates repeatable failure detection, not an automated repair. Once the Bob integration is verified, the same evidence chain will be used to evaluate an actual code change.

录同一个 buggy 目标的新真实运行、结果与历史证据；具体失败必须再次验证。禁止切换 normal 后称修复。即使使用此替代稿，也应保留 0:20–1:10 与 1:50–2:35 共 95 秒真实 Ming 操作；成片少于 90 秒真实操作时重新剪辑。

## Recording and final-cut check

- 开始录制前按最新实现重走一遍全流程，保存实际 ID、来源、指纹、工具调用、diff、运行结果和原始截图；本稿不是验证结果。
- 录当前真实界面。若 Stage D 后续完成并验证，可以替换对应画面，但不增加未经验证的旁白；概念稿必须标为 concept，且不计真实演示时长。
- 放大关键文字，保持 run/criterion 上下文可见；遮挡凭证与敏感数据，不遮挡失败、来源或不一致提示。不要打开密钥配置内容来录制。
- 英文旁白建议自然语速，给点击和读结果留停顿；时间跳转明确标注。不重配字幕或剪切顺序来制造未发生的调用/修复。
- 导出 MP4 后逐段计时：目标 170 秒，硬上限 180 秒；实际操作至少 90 秒。预留 10 秒用于停顿或片尾，不能在 180 秒之外追加片尾。
- 交付声明遵循 `docs/MING_SUBMISSION_CHECKLIST.md`；实现状态依据 `docs/STAGE_A_RESULT.md`、`docs/STAGE_B_RESULTS.md` 及录制时新增的真实 Stage C/D 结果。当前稿不证明视频、在线部署或比赛提交已完成。
