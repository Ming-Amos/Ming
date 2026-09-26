# Ming 视觉方向：应用透视图

日期：2026-09-22  
状态：用户已选择整体形式；尚未实现。

## 1. 选择记录

用户选择第二轮视觉探索的第一张，原话：“我更喜欢第一张的整体形式”。

- 已保存参考：`assets/ming-application-xray-concept-v1.png`。
- 原始生成文件：`D:/.codex/generated_images/01a0ba11-e7f1-7692-a86f-15d1f1ded2f0/exec-69c0b332-f8e5-4211-8063-e0d23632f5ce.png`；以已保存参考为实现基准。
- 生成方式：内置 Image Gen；概念图含示例数据，不能当成实际运行报告。
- 此前的光路、放映室、试验场，以及本轮其余两个方向均未选中。

## 2. 要保留的整体形式

**用实际页面作为中心，把“要求、操作、响应、失败、AI 接收的证据”展开为一张可探索的关系画布。**

- 浅色底面，深色清晰文字，克制的彩色状态标记。
- 中央主体：本次操作的页面截图或执行证据；下面展开后续状态，如刷新后的页面。
- 左侧：需求来源和已执行的操作。
- 右侧：相关请求、错误证据、原因分析及 AI 修复任务。
- 连线连接具体页面区域与对应证据，点击后展开详情。关系必须来自实际记录。
- 初始只展开一条选中功能的验收，切换功能时更新画布，避免将全项目节点堆在一屏。
- 保持常用操作可见，不要求用户必须拖动画布才能读懂一个失败。

用户选择了整体形式，未逐项确认概念图中的字体、品牌标志、微文案或每一处控件位置；实现时以可读性和准确性为准细化。

## 3. 画面随执行过程怎样变化

| 运行状态 | 画布变化 | 必须有的数据依据 |
| --- | --- | --- |
| 待开始 | 展示已确认需求与计划步骤，结果区域明确为空 | 标准版本、尚未执行状态 |
| 执行中 | 当前操作区域高亮，已完成步骤逐项出现证据 | 真实执行事件；没有实时数据时显示最近记录而非假装直播 |
| 验收失败 | 标出不符合预期的页面区域，连到相关实际证据 | 失败断言及对应运行记录 |
| 反馈给 AI | 汇总需求、步骤、预期/实际结果及证据附件 | 工具实际读取或交接记录；未读取时显示待读取 |
| 修复待复验 | 保留失败画面，说明代码已修改但尚未重新验证 | 实际代码变化记录 |
| 复验通过 | 新运行呈现通过结果，并保留修复前证据入口 | 同版标准下的实际通过记录 |

## 4. 必须修正概念图的地方

- 概念图中的请求、页面状态、数量等都是示例。页面显示与接口证据在真实产品中必须一致。
- 接口返回成功不等于功能已经完成。断言未通过时，不使用“保存已成功”等过度结论。
- 根据症状推测的原因使用虚线和“待验证”标签；不能把网络请求异常直接画成已经确定的数据库根因。
- 红色标记实际失败，绿色标记已经验证的通过；正在执行、未执行、阻塞分别显示文字和图标。
- “已发送”“已读取”“修复中”“修复成功”必须与真实事件匹配。网页负责发起验收与登记修复任务，Bob 主动调用 Ming 读取证据，因此采用“等待 Bob 读取”“Bob 已读取证据”等准确文案；不能把网页排队显示成已唤醒 Bob。
- 网页报告中的按钮若不能真正触发 Bob 修复，就不能标为一键自动修复；可改为打开修复任务和显示交接状态。
- 该视图只展示已登记范围，不宣称已经理解或验证整个项目。

## 5. 实现取舍

先实现固定布局的可点击关系画布，使用真实截图、结构化记录和可展开证据；自由拖拽、缩放和细腻动画放在完整验收流程之后。

画面中的目标应用截图来自执行器，布局与连线由前端渲染；不把整张概念图作为产品背景冒充实际界面。

## 6. 生成提示词记录

以下为选定概念图的原始生成提示词。用于追溯设计方向，不替代 PRD 中的功能边界。

Use case: ui-mockup. ONE high fidelity desktop web-app concept, canvas 1440x1024, brand Ming. Direction 应用透视图 / Application X-ray. Current date 2026-09-22, no dates visible. Chinese user explicitly rejected neon progress lines, film editing playback dashboards, and isometric conveyor factory. Wants complexity of software AUTOMATIC ACCEPTANCE CHECKS made intuitively visible as meaningful relational imagery, like understanding a codebase through a map. This concept must NOT resemble rejected options. Visual treatment sophisticated architectural X-ray exploded schematic of real application behavior, flat light warm-white infinite canvas, thin precise slate lines, black ink, indigo selected relationship, small green passed nodes, bright coral confirmed failure and dashed amber hypothesized cause. Generous readable Chinese typography, beautiful substantial central visual, no KPI cards, no standard sidebar dashboard, no timelines, no mock 3D factories, no generic marketing illustration. Product Ming desktop app, upper-left wordmark, title 看见功能背后的每一步; context TaskFlow · 保存任务; upper-right subtle 概念设计 · 示例数据. Hero: actual browser application screen floating centrally as a crisp screenshot plane, a simple todo interface with task 买咖啡 and 保存 button. Four expanded connected semantic zones surround this page, not rows: at upper left one clear requirement note 保存后刷新，任务仍存在, linked to selected save button; left lower small actual interaction record 输入任务 → 点击保存 with green check; right of screen two concrete network evidence chips POST /tasks · 200 已返回 and GET /tasks · 未包含本次任务 with timestamps t+0.4s and t+1.2s; below screen a second smaller actual after-refresh browser state with empty list, red outline around missing-record area, label 验收失败：刷新后任务消失. Use fine connector curves starting exactly from relevant page controls or evidence objects. Red X tied to verified failed condition, not to guessed database internals. Top small unobtrusive count 2 项通过 · 1 项失败 · 2 项未验证. Bottom right compact AI handoff composition: 发送给 Bob 的证据, listed 原始需求 / 操作步骤 / 请求记录 / 失败截图, then separate amber dashed note 原因待验证：写入未持久化或读取异常, explicitly hypothetical. Primary action 让 Bob 根据证据修复. Entire hero should feel like peeling back a working app to expose observable behavior: user can click controls to explore attached runtime evidence. Limit information to one selected failing scenario, minimal toolbar bottom center 缩放 适应画布. Off-white paper texture optional extremely subtle; product polish and vivid information visualization, no overlapping labels. All failure/unknown/pass states use text plus icons, not color only. Do not promise actual root-cause inference from screenshot alone. Single independent image, no multiple variants, natural proportions.
