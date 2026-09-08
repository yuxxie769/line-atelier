# 当前实际绘画交互流程

适用版本：Line Atelier v4 · R3 底稿与平滑整合版。

本文说明模型怎样与平台交互完成绘画，区分程序能力、模型动作和验证边界。工具整合后已在 R3 独立副本完成左眼真实试画，见 [试画记录](R3_LEFT_EYE_TRIAL.md)；原 R3 保留，整幅线稿未重新验收。

## 1. 谁负责什么

| 参与部分 | 实际职责 |
|---|---|
| 对话中的模型 | 读取参考与画面，判断姿态、体积、遮挡、曲线走势；选择笔迹坐标、力度、所属物体与层次；看结果并修订 |
| 浏览器与工具接口 | 页面通过 `document.modelContext`（并兼容已有 navigator 入口）注册 WebMCP 工具；调用参数交给页面执行，结果返回调用者 |
| Line Atelier 页面 | 校验命令、坐标换算、插值／平滑、压力计算、Canvas 渲染、图层合成、保存与回放 |
| 参考图 | 供观察的原图及可选提取线稿；不自动生成作品笔迹 |

网页自身没有内置模型推理服务。页面的逐笔动画是执行和回放既有指令，不是在每一帧重新思考。模型通常也不实际拖动鼠标：一笔的位置序列通过工具提交，程序沿轨迹画出。手动画笔是另外保留的输入方式。

工具也有页面 API `window.paint` 与 JSON 面板入口。两者是同一应用能力的调用方式，不等于模型已经看过画面。浏览器不支持 WebMCP 时会显示接口状态；不能把接口注册成功说成模型已开始作画。

## 2. 开始任务

先确认当前作品、画布大小、参考权限和任务阶段：`paint_get_state`、必要时 `paint_get_scene`。状态默认包含 `drawingProtocol.text` 正式规范全文、`source` 与 `sha256`，以及图层、对象、工作流、复核与播放信息；读取规范后再作画，不要直接假定旧会话里的坐标仍有效。

新作品使用 `paint_new_document` 与 `paint_set_plan` 建立画布、层次和阶段，再用 `paint_set_scene` 组织对象与共享锚点。新建画布会清除当前参考，须重新准备参考。已有作品继续修改时保留其尺寸和坐标，先读取当前状态。

唯一维护的规范正文为 [WORKFLOW_PRINCIPLES.md](WORKFLOW_PRINCIPLES.md)。项目 AGENTS 指向正文；网页状态接口和复制绘画要求使用从正文生成的模块。同一版本已读后可用 `paint_get_state({includeProtocol:false})` 省略正文，哈希改变时重新读取。仅打开页面不等于模型已加载；实际验证见 [DRAWING_PROTOCOL_VALIDATION.md](DRAWING_PROTOCOL_VALIDATION.md)。

## 3. 每个部位的基本循环

| 动作 | 主要交互 | 模型应使用的信息 |
|---|---|---|
| 看部位与底稿 | `paint_inspect_context({query:"左眼"})` | 一张四格图：参考局部、当前画布局部、带编号底稿叠图、整图位置；同时读取精简 ID 与整图坐标 |
| 确定定位与走势 | 通常无需额外工具；不足时按需读取下一页、完整几何或场景 | 找到可用占位、轴线、端点和锚点；判断沿用、偏移还是修订；不是盲目贴着任何底稿画 |
| 提交小组笔画 | `paint_submit({commands:[…],animate:false})`，或修改时 `paint_revise` | 普通批次 1–3 笔；所有绘画阶段中，同一部位、两端开放且不涉及敏感结构关系的低风险线可用 `batchMode:"low-risk-clean"` 提交 5–6 笔 |
| 看实际结果 | 再调用同部位 `paint_inspect_context` 或 `paint_observe_review`，然后 `paint_record_inspection` | 只记录 `drawingCycle.pendingTargets` 中本批实际改动目标；整图和未改部位留在 `stagePending` 阶段节点检查 |

运行循环为观察—提交普通 1–3 笔或低风险清线 5–6 笔—复看本批改动目标并记录。记录使用既有逐项检查接口；每批不另建思考表单。当前批次没有完成图像绑定检查时，下一次绘画修改会被拒绝；检查登记明确偏差后，向无关部位新增笔迹会被拒绝，直至返修、复看并处理问题。

若使用 `animate:true`，提交返回后画面可能尚未画完。看完成结果前调用 `paint_playback({action:"finish"})`。`paint_inspect_context` 是只读工具，不会替模型完成播放；其坐标来自已保存笔迹，而当前画面遵循播放位置。

在 1D refine，基本循环前增加一层程序门。进入阶段先观察整图并调用 `paint_record_refinement_diagnosis` 记录 whole 诊断；只有 `proceed` 可以开始局部。每个局部小批次前再记录 local 诊断，`detail`／`repair` 得到一次性 `diagnosisId`，`retain`／`needs-evidence` 不允许落笔。提交、返修、几何、平滑、线宽和场景结构修改都校验该 ID 与笔迹 `part/objectId`；任何画面变化后旧 ID 失效。修改后仍须走原有图像对照与五项检查，所以实际链路是“诊断 → 一小批落笔 → 看结果并记录 → 重新诊断”，首次细化和返修使用同一条链。

程序能检查调用顺序、字段完整、当前图片、区域覆盖、目标匹配和失效条件。参考事实、结构推断、当前草稿描述与动作目标是否真实，只能由模型看图判断；接口不会从参考像素自动判断衣褶受力、发束厚度或角色神态。

### 3.1 什么才叫视觉观察

调用工具返回的是结构化内容，其中图像以 PNG data URL 表达。调用环境必须把图像实际呈现给模型视觉输入，或通过受支持的图像查看流程打开；仅读取坐标、文件名、Base64 文本或测试日志不算视觉观察。

模型据实际图像判断形体；工具负责让同位置的参考、底稿和画布容易一起看到。即使获取了图像，也不能仅凭工具成功就证明模型的美术判断正确。

### 3.2 坐标怎样使用

| 数据 | 含义与用途 |
|---|---|
| 默认 `strokes[].points` | 整幅画布像素坐标；还需看 `kind` 判断它是什么点 |
| `kind: through` | 原始经过点，适合定位；启用平滑或裁切后，不保证每个普通源点仍落在可见线上 |
| `kind: bezier-control` | 贝塞尔控制柄，通常不在曲线上，不能当轮廓经过点 |
| `kind: sampled-trajectory` | 当前处理后轨迹的摘要，旧长轨迹最多抽取 32 点；`sampled:true` 表示不完整 |
| `smoothing` / `trim` / `renderedEndpoints` | 对发生平滑或裁切的笔迹，区分原始几何与处理后两端；端点仍未计入遮挡切除造成的新可见端点 |
| `anchors` | 共享锚点及其整图位置；编辑锚点可以带动关联曲线 |
| 对象 `frame:[x,y,w,h]` | 对象的整图坐标框；`space:objectId` 的点使用归一化局部坐标 |
| 图片面板 `imageToDocument` | 已包含面板偏移的图片到整图变换；不要把截图像素直接当画布坐标 |

按对象空间提交时：整图 X = frame.x + 局部 x × frame.w；Y 同理。对象 parent 只表示结构关联，不再叠加坐标变换。局部坐标不一定都在 0–1 内，扩展到框外的笔迹仍有意义。

`detail:"full"` 可取得多坐标、原始几何及独立图片；`includeImage:false` 仅查数据。候选可能来自父级人体底稿或空间相邻线条；模型要自己解释是否有关。名称不唯一返回 ambiguous，没有匹配返回 not-found，没有可用底稿返回 none-found，不伪造定位依据。

## 4. 一笔怎样变成画面

1. 命令以稳定 ID 保存源几何：through、control、path 或 points。`intent` 是简短绘画意图。
2. 程序解析对象坐标与共享锚点；through 用分段三次曲线连接，声明的 corners 保留转折。
3. 按源几何计算采样轨迹，并应用可选 taper、裁切与 `smoothing`。平滑从源轨迹重算，限制偏移；不会连续多次磨损原稿。
4. 应用压力响应、沿线压力和局部线宽修改。渲染器沿轨迹用短段圆头笔触画出，当前尚不是完整的连续变宽轮廓渲染器。
5. 每笔按其蒙版与物体遮挡处理，再按照层顺序、透明度、混合和剪贴关系合成 Canvas。
6. 稳定 ID、源几何、图层和操作顺序保留，可编辑、撤销、导出、回放。

这套流程有矢量式几何，但作品主存储是 `.line.json`，显示目标是 Canvas；不是完整 SVG 文件先生成后播放。`path` 借用了 M/L/Q/C 等路径语法，不能据此声称底层完全没有矢量表达。项目要求禁止把参考自动提取的轮廓直接转成作品路径；是否实际遵循，仍需对应执行记录。

refine、clean、lineart_review 的复杂轮廓多一层强制编译：模型不是直接给出最终 2–3 条线，而是通过 `compoundGroups`（新增）或 `compoundReplace`（返修）提交一条完整源 `path`、1–2 个有结构原因的 `lifts` 和全局 `pressureProfile`；页面按源中心线计算短搭接和接头压力，再把生成的 2–3 条笔迹送入同一渲染流程。普通单线必须显式声明 `contourMode:"simple-sweep"` 和理由；长而复杂的普通路径会被拒绝。完整方法由当前阶段的 `drawingProtocol.compoundMethod` 返回。

## 5. 阶段、反馈与审核

| 阶段 | 工作 |
|---|---|
| 1A layout | 整体占位、人体轴线与体积 |
| 1B rough | 组织全物体粗稿，衣物围绕人体 |
| 1C structure_review | 修结构、连接与遮挡，不要求在这里做正式审核 |
| 1D refine | 细化草稿，明确轮廓选择 |
| 1E clean | 独立清线，去掉试探线，组织轻重与曲率 |
| 1F lineart_review | 第一轮结构与造型；第二轮清线质量 |

每批只复看实际改动目标；阶段推进前退回整体并完成 `stagePending`。1F 两轮结合参考、实际画面、缩小及翻转；缺口扫描、区域泄漏和接头提示只是辅助。`paint_record_review` 保存模型陈述的结论，不自动判断艺术质量。相关修改会使复核 stale。

工作流启用时，平台目前已有“有效两轮审核通过后才能上色”的阶段门槛；不会新增检查模型有没有先查底稿的落笔门槛。后续阶段为头发大色块、皮肤、服装、配饰／鞋履、阴影、高光整理、局部复核。

## 6. 当前记录能证明到什么程度

`paint_submit` / `paint_revise` 可附带每组一句 `basis:{guideIds,note}`。独立会话记录保存实际参数、读取 ID、接受的源几何、前后 revision 和 PNG 引用；WebMCP、具名 `window.paint` 方法及 JSON 提交入口共用记录层。手动画笔及直接 UI 编辑不属于完整模型调用日志。

每次页面加载创建新会话，保存在浏览器 IndexedDB，与工程撤销历史分开。`paint_export_document({section:"evidence",compact:true,limit:100})` 分页读取，返回 sessionId 对应的 `id`；用 `sessionId` 可读取同一浏览器来源中已保存的旧会话。默认不含图片本体，`includeImages:true` 可带图。存储失败时仍保留当前内存记录并报告，不把已成功落笔改报失败。普通工程导出默认不含证据，导出框可勾选附带本次记录及图片；对照证据图可能含参考局部。

仓库 R3 执行记录包含提交、修订、场景、阶段、检查点等操作；其中没有完整保存本次所要求的 `inspect → submit → result image` 链。因此不能用它证明 R3 每组都按新规范读取并利用了底稿。新工具的功能测试也不能替代模型行为验证。

新左眼试画已完成并保存独立证据，详见 [R3_LEFT_EYE_TRIAL.md](R3_LEFT_EYE_TRIAL.md)。图像和笔画组按 revision、范围与文档恢复分段建立候选关联；日志自身不证明模型实际看过或看懂，仍须结合实际图像呈现与可核对改动。


## 阶段性规范加载

正式规范由 `docs/WORKFLOW_PRINCIPLES.md` 核心原则和 `docs/workflow-stages/` 六个阶段文件组成。首次阅读核心即可，不预加载全部阶段正文。

- `paint_get_state` 默认返回 `drawingProtocol.text`（核心）及 `drawingProtocol.stage`（当前阶段的 phase、source、sha256、text）。开始或恢复任务使用默认完整返回。
- `includeProtocol:false` 只省略核心正文，不省略当前阶段正文；仅用于连续操作中已读同一核心版本的情况。
- `paint_set_phase` 成功后自动返回完整核心及所选阶段要求，即使再次进入同一阶段也重新返回。
- `paint_checkpoint` 恢复检查点后按恢复的阶段返回完整要求。
- 核心和阶段各有独立哈希；更改后运行 `npm run sync:protocol`。网页副本及内嵌模块由源文件生成，不直接维护。

加载发生在工具返回中，不会主动启动新的模型调用，也不证明模型执行了观察或达到美术质量。保持 1A–1F 和 1F 两轮审核，不增加审批轮次。


## 底稿承接与局部修图说明的加载

底稿利用、局部修图步骤与底稿 ID、`basis`、坐标换算、控制柄和平滑等相关工具操作合并维护在 `docs/workflow-actions/local-revision.md`。`paint_inspect_context` 每次返回 `operationGuide`（source、sha256、text），包含该文件完整正文；在后续落笔或修订前读取。compact、full 和仅坐标返回均包含全文，不需另行加载两份文档。说明加载本身不创建新审核节点；实际绘画仍受逐批检查与先返修再继续的门槛约束。返回正文不代表模型已经实际看图或利用了底稿。

阶段推进前的实际检查：读取 localFeedback.inspection，取得目标图片后用 paint_record_inspection 逐项记录参考形状、当前形状与结论。取图本身不能解锁推进；different/uncertain 自动登记问题。检查记录随 visualChecks 保存，恢复后需要新的图像绑定记录。底稿查询取消数量分页，全部匹配候选一次返回。
