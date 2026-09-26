# Codex Stage B HTTP 独立验证

2026-09-26。**本地真实 HTTP 传输验证通过：12 个场景、248 项断言、0 失败。**这不是外部模型供应商的 live 验收。

贡献与执行：Bob 实现 Ming 适配器并修复缺陷；Codex 编写独立 HTTP 测试，主代理实际运行 operator 工作区脚本两次。本记录由独立审查代理核对保存报告、当前代码指纹和清理状态后整理，未再次运行测试。

| 轮次 | 本机报告 | 结果 |
| --- | --- | --- |
| 首次 | `runtime/review-provider-http-2026-09-26T06-10-54-503Z-37e9063e.json` | 248 项中 1 项失败：错误正文先截断再脱敏，会保留假密钥片段 |
| Bob 修复并重新构建后 | `runtime/review-provider-http-2026-09-26T06-12-48-140Z-91596562.json` | 248 项全部通过；首轮失败证据保留 |

两次均使用 `http.createServer()` 的随机回环端口和真实 `OpenAICompatibleTransport`，每个场景确实收到一次 HTTP 请求。覆盖 API 根路径/前缀/末尾斜杠、Authorization 与 model/messages 映射、服务端可信 test 标识、401 完整及截断边界脱敏、429、畸形响应/模型 JSON、512 KB 上限，以及持续传输时的硬超时。

复验中慢响应发送 281 个数据块，30,001 ms 后返回 timeout，独立看门狗未介入。所有连接均在测试强制清理前关闭；各场景强制关闭数为 0；最终剩余 socket 为 0、夹具计时器为 0、服务器已关闭。两轮外网请求尝试均为 0，只用假凭据；报告不保存凭据或原始请求/响应。

复验报告记录的 source/dist SHA-256 与本次审查时文件一致：

- source：`4740f61d9bbbff585473a5d6414f8c5347881704812a08d7669bf672595b3d34`
- dist：`42679eb4318bf7a5e9765432c37e2571b1ae6094454bb35486df861012efa662`

Codex 已将脚本整理至 `scripts/review-provider-http.mjs`，项目根目录改为相对脚本位置解析。此项目内副本仅通过 `node --check`，尚未从新位置实际运行；上述报告来自 operator 工作区原脚本。后续构建通过后可在项目目录执行 `node scripts/review-provider-http.mjs`；报告仍写入忽略的 runtime 目录。

限制：仅证明被测构建的本地 HTTP 请求、返回结果和连接清理；不证明外部供应商兼容性、模型生成质量、HTTPS/TLS、网页闭环或全服务持久化日志均无敏感信息。真实供应商调用仍待用户配置凭据后单独验证。
