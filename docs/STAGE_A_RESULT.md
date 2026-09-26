# Stage A 完成报告

**完成时间：** 2026-09-26  
**执行者：** Bob（IBM Bob Personal Trial）  
**工作区：** `C:\Bob\Projects\Ming`

---

## 1. 实际改动与启动方式

### 项目结构

```
apps/web/           Ming 网页（React 18 + Vite 5，端口 4000）
apps/server/        Ming 本地服务（Express + ts-node，端口 4001）
packages/contracts/ 共享类型（TypeScript）
packages/runner/    浏览器执行器（Playwright Chromium）
packages/fingerprint 计划/目标指纹（SHA-256 深度递归）
examples/daily-report/normal/   正常版日报（localStorage 持久化）
examples/daily-report/buggy/    预置缺陷版（内存，刷新丢失）
fixtures/stage-a-plan.json      固定验收计划（source: fixture）
runtime/runs/       运行记录（JSON，不提交原始内容）
runtime/screenshots/截图（按 runId 关联）
scripts/            测试脚本（负面测试、UI 自动化）
```

### 启动步骤

```bash
# 1. 安装依赖（首次）
pnpm install

# 2. 安装 Playwright Chromium
pnpm --filter @ming/runner exec playwright install chromium

# 3. 编译 runner 和 server
pnpm --filter @ming/runner run build
pnpm --filter @ming/server run build

# 4. 启动后端服务（端口 4001）
node apps/server/dist/index.js

# 5. 另开终端，启动 Web 开发服务（端口 4000）
cd apps/web && node node_modules/vite/bin/vite.js --port 4000 --host 127.0.0.1

# 访问 Ming 网页：http://127.0.0.1:4000
# 日报样例（正常）：http://127.0.0.1:4001/normal
# 日报样例（缺陷）：http://127.0.0.1:4001/buggy
```

---

## 2. 运行结果与证据

### 计划信息

| 字段 | 值 |
|------|-----|
| 计划ID | `stage-a-daily-report` |
| 版本 | `1.0.0` |
| 计划指纹 | `660582f7fbabccc5` |
| 来源 | `fixture`（固定开发夹具，未接入模型） |

### 运行 1：正常版（脚本执行）

| 字段 | 值 |
|------|-----|
| 运行ID | `979bcdfa-aeab-4f75-a8a3-d2729c5c4266` |
| 目标 | `normal` |
| 目标指纹 | `c608e21d187e5f84` |
| 开始时间 | `2026-09-26T05:22:52` |
| 总体状态 | ✅ **passed** |
| AC-01 | ✅ passed — 非空内容可提交并显示 |
| AC-02 | ✅ passed — 刷新后内容仍存在（localStorage 持久化） |
| AC-03 | ✅ passed — 空字符串与纯空白提交均被拒绝 |

截图：`runtime/screenshots/979bcdfa-*_{AC-01,AC-02,AC-03}_final.png`

### 运行 2：预置缺陷版（第1次，脚本执行）

| 字段 | 值 |
|------|-----|
| 运行ID | `8cbba6a2-8698-43ac-a88e-2222ea1c83e2` |
| 目标 | `buggy` |
| 目标指纹 | `4d61d95b3ffbc28d` |
| 开始时间 | `2026-09-26T05:22:56` |
| 总体状态 | ❌ **failed** |
| AC-01 | ✅ passed |
| AC-02 | ❌ **failed** — 步骤AC-02-S2：刷新后 `#reportList` 中不可见已提交内容（预期缺陷：内存丢失） |
| AC-03 | ✅ passed |

失败证据：
- `runtime/screenshots/8cbba6a2-*_AC-02-S2_failed.png`
- `runtime/screenshots/8cbba6a2-*_AC-02-S2_failure_scene.png`

### 运行 3：预置缺陷版（第2次，新测试数据）

| 字段 | 值 |
|------|-----|
| 运行ID | `29065a34-31cd-4554-a4e5-f3f3a4a1dbf8` |
| 目标 | `buggy` |
| 目标指纹 | `4d61d95b3ffbc28d` |
| 开始时间 | `2026-09-26T05:22:58` |
| 总体状态 | ❌ **failed** |
| AC-01 | ✅ passed |
| AC-02 | ❌ **failed** — 新数据（`Ming测试-buggy-1790400178242`）同样刷新丢失 |
| AC-03 | ✅ passed |

历史记录与截图均保留，不覆盖前次。

### 运行 4：正常版（Web UI 触发）

| 字段 | 值 |
|------|-----|
| 运行ID | `5a09b5d0-374a-4cc5-b574-86e50d8dcfb2` |
| 目标 | `normal` |
| 总体状态 | ✅ **passed** |

### 运行 5：预置缺陷版（Web UI 触发）

| 字段 | 值 |
|------|-----|
| 运行ID | `1f34289f-39dc-4811-a530-a3f1f8f225fa` |
| 目标 | `buggy` |
| 总体状态 | ❌ **failed**（AC-02 失败，AC-01/03 通过） |

---

## 3. 验证摘要

### 正向测试（脚本 `scripts/run-stage-a-tests.mjs`）

- ✅ 正常版：AC-01/02/03 全部通过
- ✅ 缺陷版第1次：AC-01 通过、AC-02 失败、AC-03 通过（预置缺陷被发现）
- ✅ 缺陷版第2次：使用全新唯一测试数据，仍然发现同样缺陷，历史保留

### 负面测试（脚本 `scripts/run-negative-tests.mjs`）：29/29 通过

| 编号 | 场景 | 结果 |
|------|------|------|
| 1 | confirmed 字段缺失 | ✅ HTTP 400 |
| 2 | confirmed = "true"（字符串） | ✅ HTTP 400 |
| 3 | confirmed = 1（数字 truthy） | ✅ HTTP 400 |
| 4 | 错误的 confirmedPlanId | ✅ HTTP 400 |
| 5 | 过期计划指纹 | ✅ HTTP 400 |
| 6 | 无效 variant（production-live） | ✅ HTTP 400 |
| 7 | 未知 runId → GET /api/run/:id | ✅ HTTP 404 |
| 8 | 未知 runId → GET /api/run/:id/progress | ✅ HTTP 404 |
| 9 | 目标不可达（ERR_CONNECTION_REFUSED） | ✅ status=error，步骤记录错误 |
| 10A | 未知 step type（executeScript） | ✅ 抛出错误，不执行浏览器 |
| 10B | fill 缺必填字段 locator | ✅ 抛出错误，不执行浏览器 |

### Web UI 自动化测试（脚本 `scripts/run-ui-tests.mjs`）：26/26 通过

- ✅ 页面加载、计划展示、fixture 标记可见
- ✅ 正常版/缺陷版目标选择器
- ✅ 确认前按钮禁用、确认后可用
- ✅ UI 触发正常版运行，通过 runId 轮询确认完成，AC-01/02/03 全部 passed
- ✅ UI 触发缺陷版运行，AC-01 passed / AC-02 failed / AC-03 passed
- ✅ AC-02 失败详情：期望/实际标签可见
- ✅ 失败截图按钮存在，点击后图片加载完成（naturalWidth=1280）
- ✅ 历史面板可见，按 runId 前缀定位历史条目，点击显示历史详情面板

Web UI 截图：`runtime/screenshots/ui-2026-09-26T05-40-10/`（7张）

### TypeScript 类型检查

- ✅ `packages/contracts` — noEmit 无错误
- ✅ `packages/runner` — noEmit 无错误
- ✅ `apps/server` — noEmit 无错误
- ✅ `apps/web` — noEmit 无错误

---

## 4. 架构说明

### 执行链路

```
用户在 Ming 网页确认计划
  → POST /api/run（confirmed: true, planId, planFingerprint）
  → 服务器验证确认参数（严格 boolean true, planId 匹配, 指纹匹配）
  → 生成唯一 runId 立即返回
  → PlanRunner 异步执行：
       AC-01（fresh context）→ 填写唯一内容 → 提交 → assertVisibleIn #reportList
       AC-02（inherit context）→ 依赖 AC-01 passed → reload → assertVisibleIn #reportList
       AC-03（fresh context）→ 独立场景 → 空字符串+纯空白各测一次
  → onCriteriaComplete 回调更新 liveProgress
  → 截图保存至 runtime/screenshots/<runId>_<stepId>_<type>.png
  → RunRecord 写入 runtime/runs/<runId>.json
  → 前端轮询 /api/run/:runId/progress → 完成后取 /api/run/:runId 渲染结果
```

### 关键设计要点

- **计划指纹**：SHA-256 深度递归序列化（排除 `fingerprint` 键自身），前16位十六进制
- **上下文继承**：AC-01/02 共享 BrowserContext（AC-02 是 contextMode: "inherit"），AC-03 独立上下文
- **not_run 状态**：浏览器启动前抛出错误时，未到达的标准记录为 `not_run`
- **blocked 状态**：依赖的前置标准未通过时记录为 `blocked`
- **目标隔离**：服务器只允许两个预配置本机地址，不提供任意 URL 执行端点

---

## 5. 已知限制

1. **无模型接入**：计划来自固定夹具（`source: fixture`），网页明确标注"开发验证样例，尚未接入模型生成"。阶段 B 接入。
2. **无 MCP 接入**：Bob 无法通过工具读取 Ming 结果并修复目标代码。阶段 C 接入。
3. **计划仅支持必要步骤类型**：`navigate / fill / click / reload / assertVisible / assertVisibleIn / assertNotVisible / assertCount / assertInputEnabled / assertInputDisabled`。更丰富的步骤类型留阶段 B/C。
4. **并发运行**：当前无限制，多个并发运行共享同一进度 Map；阶段 A 不涉及并发场景。
5. **localStorage 隔离**：每次运行均使用独立的新 Playwright BrowserContext（fresh per run），不共享也不累积前次运行的 localStorage 数据。正常版的 `ming_demo_reports_normal` 存储键在每轮 BrowserContext 内是全新的；不同运行之间不存在污染。
6. **Vite 须用 `node vite/bin/vite.js`**：Windows 下 `node_modules/.bin/vite` 是 shell 脚本，不能直接以 `spawn` 调用。
7. **用量**：当前 Bob 账号为个人试用，比赛资格待主办方确认。本阶段 Bob 会话消耗请从 IDE Task 面板截图存入 `bob_sessions/`。

---

## 6. 下阶段所需信息

**阶段 B（模型接入）**

- 用户提供的国内模型 API 端点和密钥（环境变量，不在聊天中传输）
- 模型输入格式确认（是否接受中文 PRD？token 限制？）
- 生成的验收计划是否需要人工审核界面扩展

**阶段 C（Bob MCP + 修复演示）**

- MCP 服务器配置（Bob 工具权限范围）
- 修复演示需要实际修改 `examples/daily-report/buggy/index.html` 源码（不是切换 variant）

---

*本报告数据来自实际 Playwright 执行，运行 ID 和截图路径均可在 `runtime/` 目录验证。*  
*Bob 会话消耗摘要请由用户从 IDE 截图，不在此估算。*
