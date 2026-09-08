# 底稿承接与局部修图操作说明

适用于依据已有底稿细化、清线或局部修图。`paint_inspect_context` 在返回部位上下文时自动附带本说明全文；先读取说明并观察图片，再落笔或修订。新作品尚无底稿时先按参考定位，不要求引用不存在的底稿。

## 利用底稿绘画与局部修图

在 1D refine 中，这个循环之前还有强制诊断门。首次进入 1D 先用整图对照调用 `paint_record_refinement_diagnosis({scope:"whole",...})`；只有 `decision:"proceed"` 才能开始分部位。此后每个局部小批次前都用当前原尺寸对照记录 `scope:"local"`，填写参考事实、结构推断、草稿事实、不确定处及 `detail`／`repair`／`retain`／`needs-evidence`。这适用于正常首次细化和返修；不是等发现错误后才启动。

`detail`／`repair` 返回的 `diagnosisId` 只对当前画面、对应 `target` 和下一小批修改有效。提交、替换、删线、几何、平滑、线宽或场景结构修改后即失效；先按修改后检查流程复看，再重新诊断。`retain` 与 `needs-evidence` 会被程序禁止落笔。历史诊断保存在工程中供审计，但导入、恢复或刷新中的旧记录不授权新操作。

在 1E clean 中使用更短的通用循环，任何部位都一样：先用 `basis.guideIds` 绑定同部位已确认底稿，清 1–3 笔，再通过 `paint_inspect_context` 同时看参考、底稿和当前清稿，调用 `paint_record_inspection` 只记录 `draftComparison.outcome` 为 `preserved`、`improved` 或 `regressed`。前两者允许继续；退步后程序只允许返修当前部位。五项 `comparisons` 只在 `stagePending` 的阶段出口提交。

1. **先看图。** 用 `paint_inspect_context` 取得参考图、当前画布、底稿叠图和坐标。实际查看图片，仅读坐标或 Base64 不算看图。所有修改提示遵循同一句硬要求：**修改前后都必须对比参考图。** 这包括返修、替换或删除笔迹、移动几何点、编辑线宽与压力、平滑以及 issue 处理。
2. **确定依据。** 以参考图确定目标形状，读取底稿 ID 和经过点／锚点，分清它提供的位置、方向、体积或轮廓依据。改形前先找出当前偏差，再决定沿用或修稿；没有明确偏差不随意改形。对象不明或数据不全时补查，不重估全部位置。
3. **少量落笔。** 普通 `paint_submit` 与 `paint_revise` 每批提交 1–3 笔。所有绘画阶段中，对同一部位、两端开放且不涉及敏感结构关系的低风险线，可用 `paint_submit({batchMode:"low-risk-clean",commands:[…]})` 提交 5–6 笔；五官、手脚、接头、遮挡和关键转折不使用该模式。清稿阶段的 `basis.guideIds` 是硬要求，并须覆盖每个实际修改目标。
4. **对照、记录、返修。** 完成播放后，按 `localFeedback.inspection.pending` 给出的方式复看。清稿批次只记录底稿承接的三选一结果；其他阶段沿用其批次要求。`localFeedback.inspection.stagePending` 单列阶段出口检查。清稿结果为 `regressed` 时，不能转画其他部位，只能修当前部位并重新检查。

同一部位可复用有效上下文；形状、底稿、坐标框或遮挡有相关变化时重新观察。底稿缺失或有误时，简述原因后补稿、修稿或自主落笔；空白起稿先按参考图定位。不增加逐笔审批或正式审核轮次；阶段推进前必须完成下述图像绑定检查记录。

在 refine、clean、lineart_review 中还要先做轮廓分类。能一气呵成的普通单线在每条 command 上写 `contourMode:"simple-sweep"` 和 `simpleSweepReason`；复杂轮廓不用普通 command，新增时放进 `compoundGroups`，替换时放进 `compoundReplace`，给出完整 `path`、1–2 个 `lifts` 及全局 `pressureProfile`。程序生成的 2–3 笔按实际笔数占用批次额度；直接手写 `compoundId`、省略普通线分类或提交检测为长而复杂的普通路径都会被拒绝。

默认点坐标为整幅画布像素；`space:objectId` 使用对象 frame 对应的局部坐标。截图像素须经 `imageToDocument` 换算。贝塞尔控制柄通常不在曲线上；平滑／裁切后的源经过点与可见轨迹也可能不同，按返回的 `kind`、`smoothing`、`trim` 和 `renderedEndpoints` 区分。共享锚点与几何编辑的具体参数按接口说明读取。

平滑随落笔或单次修线完成，不增加独立阶段。保持有意义的转折与曲线节奏；平滑不能代替形体判断。

发现需要持续处理的具体偏差，用 `paint_update_issue` 的 `open` 登记描述、`objectIds` 与整幅坐标的 `region`。问题保存在工程 `partIssues` 中，空的审核 `issues` 不会清除它。相关改线后变为 `awaiting-review`；对象不明、删除笔迹或恢复历史时保守要求复查。

修改后，完整播放状态下的 `paint_inspect_context` 图像结果会返回 `observation.id`；纯坐标、参考未授权或播放未结束时不会产生有效凭据。也可用 `paint_observe_review` 返回参考与画布局部对照。实际查看后，用 `paint_update_issue` 的 `resolve` 提交问题 ID、说明与 `observationIds`。问题解决后，只有其 `guideIds`、`objectIds` 或区域几何被相关修改时才重新变为 `awaiting-review`；无关部位落笔保持 `resolved`，重复 resolve 不新增历史。阶段最终审核仍使用当前局部图片复核已解决问题。

## 修形目标如何持续带回

在既有问题上用 `amend` 更新 `target` 和 `guideIds`，保留问题 ID；无需重新登记一份。`target` 说明参考中需要恢复的形状关系，例如“保留脚跟突出，足背到前掌逐渐变宽，脚尖最后收束”。具体定位仍使用真实底稿经过点或场景锚点，程序不会从这句话生成轮廓，也不会自动分析参考图。

按 `objectId`、唯一 `query` 或区域查看时，工具返回相关问题及所属图层，自动把问题引用的有效 `guideIds` 加入底稿候选。底稿被删除时返回 `missingGuideIds`，不能把不存在的依据当成已经读取；所有匹配底稿一次完整返回，不设数量限制或分页。

对象 `frame` 也用于局部坐标换算，不一定是合适的观察范围。若它明显大于该部位实际笔迹，程序按部位笔迹裁切并返回 `cropBasis:part-geometry`，保持原 `frame` 不变；合理的 frame 仍保留，显式 `region` 优先。查看时核对返回 `region`，不要把整图缩略视为局部放大。

## 改线后如何得到下一步

`paint_submit`、`paint_revise`、几何和线宽编辑等返回 `localFeedback`。其中 `next` 列出已跟踪改动但尚无当前有效局部对照图的部位，带修改前后范围、版本和可直接调用的 `nextInspection`；读取状态或部位上下文也持续返回。程序合并同一部位的改动范围，不会因下一批提交把之前尚未覆盖的位置丢掉。

调用建议的查看工具，实际比较同尺度参考和画布，逐段检查转折、宽窄和相邻空隙，再决定沿用或修正。有效图片返回后，该范围可以从待取图列表消失，但登记的问题仍须按原有 `resolve` 流程处理，图像返回不自动解决问题。播放未完成、只有坐标、缺参考或图片太小不会消除待取图提示。工程保存 `localChanges`；重载后重新取得当前图像凭据，历史作品缺少该字段时明确属于未跟踪，不能解释为已全部复看。

`localFeedback` 提供下一步材料，不会替模型执行绘画或触发新的模型调用。当前批次未完成图像绑定检查时，下一次绘画修改会被拦截；已登记问题未处理时，不能向无关部位新增笔迹。阶段推进仍使用下述检查记录，不增加正式审核轮次。

## 图像绑定的检查记录

底稿候选不分页：paint_inspect_context 一次返回全部匹配笔迹，limit/offset 不再提供；旧参数不能截断结果。范围仍按 objectId/query/region 确定，不等于返回全工程无关笔迹。

读取 `localFeedback.inspection`：`pending` 只给出本批实际改动目标，`stagePending` 给出阶段推进前的整图与最终部位目标，`criteria` 给出阶段出口必须比较的项目。清稿的 pending 按 `nextInspection` 取得参考、绑定底稿和当前清稿，然后调用 `paint_record_inspection({target,observationIds,draftComparison:{outcome,note}})`。阶段出口才调用带 `comparisons` 的同名工具。

1D／1E／1F 必须分别提交 likeness（临摹一致性）、volume（体积）、boundary（边界）、detail（细节）、coherence（整体协调）五项；不能沿用旧的三项记录。每项可用 `comparisons[].observationIds` 指定依据，否则展开保存共享 ID，均需当前版本且覆盖目标。`inspection.targets` 给出目标的 pass／needs-work／needs-evidence／stale／needs-inspection；改动影响的通过状态失效，历史记录不授权恢复后的推进。

绘画修改前，程序在完整播放且参考可读时保留最近一次修改前渲染状态。随后取图会返回同区域同倍率的 `beforeAfter`，其 `drawing` 为修改前画布；当前画布仍在正常图片字段中。available 时必须填写 `changeSummary` 说明具体改善或退步及相邻影响，并实际查看两张图。unavailable 明确表示无前图或因恢复、参考、阶段变化无法配对，不能宣称已比较；先取得当前观察，下一次修改重新保存快照。前图只供比较，不是当前通过凭据。取图不改变笔迹；图像进会话日志，快照不作为参考底图或导入授权保存。

首次问题列表为空正常。different/uncertain 会自动登记问题，reference 保存为目标；aligned 不会虚构问题。修正后重新取图、重新检查，并按已有问题解决流程逐项处理。图片返回本身不会完成检查。

前进到下一绘画阶段、关闭已启用流程、提交 1F 正式通过时，程序要求完整检查记录；仍可留在本阶段修改或退回修稿，不增加逐笔许可。记录保存在工程 visualChecks 和全量调用日志中。导入、恢复或刷新后，历史记录仅供审计，须用本次图片重新检查。局部检查按该区域几何判断失效，整图检查对整体变化失效。程序只能证明提交了绑定图像的检查记录，不能证明真实注意或视觉判断正确。
