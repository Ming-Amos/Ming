# Ming

**Every "done" comes with proof. — 每一句"已完成"，都有据可验。**

面向 AI 辅助开发的网页验收工具：从需求形成标准，执行真实浏览器检查，收集失败证据，交给 Bob 修复后复验。

## 当前状态

**阶段 A 与阶段 B 本地验证通过（2026-09-26），真实模型生成仍待供应商配置。**

Ming 可以在本机运行：打开网页选择目标 → 确认固定验收计划 → 真实 Playwright 浏览器执行 → 查看失败证据与截图 → 查看历史记录。阶段 B 增加保存需求、生成并审查草案、确认后执行与同标准重跑的流程；已用明确标注的本地夹具验证，尚未验证真实模型的生成质量。

初始规划文档由用户与 Codex 整理；阶段 A/B 核心实现及核心修复由 IBM Bob 完成。Codex 负责独立审查、部分验证脚本与测试修正、文档汇总及真实会话证据采集，详细归属见阶段报告。

账号说明：用户已用原报名邮箱开通 Bob 个人试用并登录，是否可用该账号参赛仍待主办方确认。Bob 会话消耗请从 IDE Task 面板截图，见 [bob_sessions/README.md](bob_sessions/README.md)。

## 快速启动

```bash
# 1. 安装依赖（首次）
pnpm install

# 2. 安装 Playwright Chromium（首次）
pnpm --filter @ming/runner exec playwright install chromium

# 3. 编译（首次或代码有改动后）
pnpm build

# 4. 启动后端服务（新终端，端口 4001）
node apps/server/dist/index.js

# 5. 启动 Web 开发服务（另一新终端，端口 4000）
cd apps/web
node node_modules/vite/bin/vite.js --port 4000 --host 127.0.0.1
```

打开浏览器访问：**http://127.0.0.1:4000**

> **注意**：Windows 下不能直接 `node_modules/.bin/vite`（shell 脚本），需用 `node node_modules/vite/bin/vite.js`。

### 示例目标地址

| 目标 | 地址 |
|------|------|
| 正常版（localStorage 持久化） | http://127.0.0.1:4001/normal |
| 预置缺陷版（刷新丢失） | http://127.0.0.1:4001/buggy |

## 运行验收测试脚本

```bash
# 正向测试（正常版+缺陷版×2）
node scripts/run-stage-a-tests.mjs

# 负面测试（未确认/错误指纹/无效计划/不可达目标等 29 项）
node scripts/run-negative-tests.mjs

# Web UI 自动化测试（Playwright，26 项）
node scripts/run-ui-tests.mjs
```

## TypeScript 检查与构建

```bash
pnpm typecheck          # 全部包 noEmit 检查
pnpm build              # 全部包编译
```

## 阶段 A 结果

详见 [docs/STAGE_A_RESULT.md](docs/STAGE_A_RESULT.md)。

- 正常版：AC-01/02/03 全部通过（planFP: `660582f7fbabccc5`）
- 缺陷版：AC-01 通过、**AC-02 失败**（刷新丢失）、AC-03 通过
- 连续两次缺陷版运行使用不同唯一测试数据，均发现同样缺陷，历史保留
- 负面测试 29/29 通过（未确认/字符串 confirmed/错误指纹/无效计划/不可达目标等）
- Web UI 26/26 通过（含 runId 精确追踪、截图 naturalWidth 验证、历史 runId 查找）

## 可切换的模型配置

当前实现 **OpenAI 兼容的 Chat Completions 协议**。切换兼容服务时，在本机 `apps/server/.env` 设置 `PROVIDER_LABEL`、`PROVIDER_BASE_URL`、`PROVIDER_MODEL_ID` 和 `PROVIDER_API_KEY`，然后重启后端；配置字段说明见根目录 `.env.example`。地址填写包含版本前缀的 API 根路径，服务端会追加 `/chat/completions`。其他协议仍需另外实现适配器，并非任意 API 都能直接使用。

密钥只填入被 Git 忽略的本机服务端文件，不放入网页、截图或提交仓库。尚未选供应商时，可先使用阶段 A 的固定计划检查示例；阶段 B 会明确提示未配置，不会偷偷用夹具假装真实模型。真实供应商接入后仍需完成一次生成、人工审查确认和浏览器执行验证。

阶段 B 的本地结果与限制见 [docs/STAGE_B_RESULTS.md](docs/STAGE_B_RESULTS.md)：路由合同 79 项、真实本地 HTTP 248 项、独立边界 12 项和真实网页 39 项检查通过。网页测试包含同一确认记录重跑及真实截图加载。

## 尚待完成

- 真实模型供应商配置及生成质量验收
- Bob MCP 工具接入与实测（读取失败证据 → 修复代码 → 复验，正在开发）
- 第二个业务示例及已选定的正式视觉界面
- 真实部署（当前仅本机 127.0.0.1）

## 文档

- [BOB_START_HERE.md](BOB_START_HERE.md) — 阶段 A 规格
- [docs/MING_PRD.md](docs/MING_PRD.md) — 产品需求
- [docs/MING_BUILD_PLAN.md](docs/MING_BUILD_PLAN.md) — 开发计划
- [docs/STAGE_A_RESULT.md](docs/STAGE_A_RESULT.md) — 阶段 A 完成报告
- [docs/MING_VISUAL_DIRECTION.md](docs/MING_VISUAL_DIRECTION.md) — 视觉方向
- [bob_sessions/README.md](bob_sessions/README.md) — Bob 会话证据采集说明

## 赛事信息

- [IBM Bob 2.0 Hackathon](https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon)
- [官方参赛指南](https://lablab-ibm-bob-2-hackathon-guide.s3.us.cloud-object-storage.appdomain.cloud/index.html)
