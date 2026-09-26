# Ming

**Every "done" comes with proof. — 每一句"已完成"，都有据可验。**

面向 AI 辅助开发的网页验收工具：从需求形成标准，执行真实浏览器检查，收集失败证据，交给 Bob 修复后复验。

## 当前状态

**阶段 A 已完成（2026-09-26）。**

Ming 可以在本机运行：打开网页选择目标 → 确认固定验收计划 → 真实 Playwright 浏览器执行 → 查看失败证据与截图 → 查看历史记录。

初始规划文档由用户与 Codex 整理；阶段 A 实现（Runner、Server、Web UI、测试脚本）由 IBM Bob 完成。

账号说明：用户已用原报名邮箱开通 Bob 个人试用并登录，是否可用该账号参赛仍待主办方确认。Bob 会话消耗请从 IDE Task 面板截图，见 [bob_sessions/README.md](bob_sessions/README.md)。

## 快速启动（阶段 A）

```bash
# 1. 安装依赖（首次）
pnpm install

# 2. 安装 Playwright Chromium（首次）
pnpm --filter @ming/runner exec playwright install chromium

# 3. 编译（首次或代码有改动后）
pnpm --filter @ming/runner run build
pnpm --filter @ming/server run build

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

## 未实现（阶段 B/C）

- 模型 API 接入（用户自备国内模型，密钥尚未配置）
- Bob MCP 工具接入（读取失败证据 → 修复代码 → 复验）
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
