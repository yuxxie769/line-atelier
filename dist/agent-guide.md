# Line Atelier · v4 R3 模型绘画接口（底稿与平滑整合版）

网页不内置模型。模型通过支持 WebMCP 的浏览器调用页面工具；普通浏览器仍可使用手动画笔和 JSON 面板。当前主入口载入 R3 半身线稿（361 条笔迹、211 条清线、7 个阶段检查点），保留 R2 和旧结构修订稿入口。工具更新不等于作品重新验收，本次未重画或上色。

本版整合 `paint_inspect_context` 和 `smoothing` / `paint_smooth_strokes`。默认一张对照图与精简整图坐标，完整几何和独立图片按需读取；无新增人工底稿操作入口。整合保留上传版本的隐藏底稿、锚点与多坐标能力。

实际交互说明和完整功能表见仓库 `docs/ACTUAL_DRAWING_WORKFLOW.md`、`docs/PLATFORM_FEATURES.md`。正式指令固定加载和按组执行证据的待实施方案见 `docs/DRAWING_IMPLEMENTATION_PLAN.md`；网页说明不能保证模型自动加载这些规范。

正式工作流与质量标准见 [workflow-principles.md](workflow-principles.md)，包含八项原则、1F 两轮审核和九项质量要求。工具说明见 [drawing-tools.md](drawing-tools.md)。

## 绘画纪律

完整线稿 → 头发大色块 → 皮肤底色 → 服装大色块 → 配饰／鞋履底色 → 覆盖阴影 → 高光与整理 → 局部复核。

线稿内部：`layout` 整体定位 → `rough` 完整粗稿 → `structure_review` 结构修稿 → `refine` 细化草稿 → `clean` 独立清线 → `lineart_review` 两轮整体审核（结构与造型 → 清线质量）。

先建立衣物下的完整人体：头、胸廓、骨盆、肩肘腕、髋膝踝以及足部的落点，再围绕人体画衣服、头发和配饰。人体构造层保留为辅助，最终隐藏。

每个物体也从大形到细节。画完一个小结构就看画布、同位置参考和相邻结构；先修比例和体积，再处理线条轻重、接头和闭合。粗稿允许试探，清线需要选择和重画，不是把所有旧线统一描深。二次元比例以参考风格为准，不套用固定头身比。

参考线稿提取仅用于观察。禁止把提取像素、轮廓或分区自动转换为画布路径、选区和上色轨迹。模型根据观察自行选择几何；算法只负责这些几何的插值、受限平滑、编辑与渲染。上色也应组织连续宽笔与区域叠层，不进行像素差值补丁。

## 一次查看部位底稿与定位依据

开始一个部位前，优先调用 `paint_inspect_context({query:"左眼"})`，或使用明确的 `objectId` / `[x,y,w,h]` 的 `region`。它把原本分开的观察和坐标查询合并，不检查绘画是否合格，也不拦截下笔。

默认返回一张四格对照图（参考、当前画布、底稿叠图、整图位置）及精简笔迹坐标。`detail:"full"` 才返回底稿独立图、原始几何、多种坐标、意图等详细内容。图片中的底稿编号对应 `strokes[].label`（详细模式为 `commands[].label`）。贝塞尔控制点明确标为 `bezier-control`，不能当成曲线上经过点；旧采样轨迹默认最多取 32 点，完整点可用 `paint_get_strokes({ids:[...]})` 读取。

候选按显式指定、目标底稿、祖先物体底稿、空间相交底稿、其他笔迹排序。例如人体层的眼线即使归属 figure，也能随左眼查询返回。模型需要自己判断这些线是否有用、是否准确；空间相邻不等于语义正确。`guideIds` 可以显式补充候选。`nextOffset` 非空时用相同参数和返回的 offset 读取下一页（每页默认 24 条）；每页图像仅标注该页底稿。

默认四周留 40 画布像素，可用 `padding` 调整。读取不会改变画布、图层显示、播放位置、复核或历史。底稿观察图显示保留的草稿几何，不应用遮挡或蒙版，因此不代表最终作品。当前画布图遵循播放位置，坐标来自已保存几何；需看完成结果时先完成播放。原始参考使用既有位置变换，与画布裁切对齐；未授权时仅返回 `referenceStatus: access-disabled`，不会泄露参考。

启用平滑或裁切的笔迹额外返回 `smoothing` / `trim` 与 `renderedEndpoints`。`through` 的 points 是源经过点，`bezier-control` 是控制柄，`sampled-trajectory` 是处理后轨迹的摘要；不能混为实际画面上的同一种点。

使用习惯：先看图，再读相关线的坐标，自行决定沿用、偏移或修订底稿；小批落笔后复看。此工具不建立自动追随底稿的关系，不把候选线变为强制约束。这是模型接口，不增加人工按钮或面板。默认返回一张四格对照图（参考、当前画布、底稿叠图、整图位置）和精简笔迹坐标；`detail:"full"` 按需读取原始几何、多种坐标及独立图片，`includeImage:false` 只读取坐标。图片各面板的 `imageToDocument` 已包含面板偏移，模型无需自行推断截图布局。

## 先了解工作台与参考

- `paint_get_state({})`：画布尺寸、工作流、对象、图层、检查点、复核、回放状态。
- `paint_get_scene({})`：完整对象、锚点、区域、遮挡及基础线端提示。
- `paint_get_reference({})`：读取已授权参考的缩略图。
- `paint_prepare_reference({})`：本地提取亮度边缘／局部对比度参考线稿。该滤镜可能包含阴影伪边，不是 Anime2Sketch，不产生任何绘画指令。
- `paint_snapshot_region({region:[x,y,w,h],scale:3,source:"drawing",mirror:false})`：按目标分辨率重绘几何；不会移动时间轴。`source:"reference"` 裁切原始参考，`"reference-lines"` 裁切提取参考。参考访问需要页面勾选许可。scale 为 0.25–4，单边输出最多 4096 像素。返回坐标换算；翻转不改变文档坐标。
- `paint_snapshot({maxSize:1024})`：整图缩略图。

经过点、贝塞尔原件会重新采样；旧工程只剩采样点的笔迹按折线重绘，不声称恢复已经丢失的控制点。

## 建立物体与局部坐标

`paint_set_scene` 原子替换传入的集合，未传入的集合保留。已有引用的 ID 必须保留。

```json
{
  "objects": [
    {"id":"face","name":"脸部","frame":[200,190,150,140],"phase":"rough"}
  ],
  "anchors": [
    {"id":"chin","objectId":"face","point":[0.48,0.93],"corner":false}
  ],
  "note":"观察脸部占位与下巴，建立模型选择的空间坐标"
}
```

frame 始终为文档坐标 `[x,y,w,h]`。`space:"face"` 中的经过点使用 0–1 局部坐标；程序换算为文档坐标。对象 parent 仅表达结构上下文，不叠加另一重变换。锚点可带 `tangent:[dx,dy]` 指定共享切线方向，或 `corner:true` 保留尖角。

对象、图层和时间阶段是三件不同的事。一个物体可以有粗稿、底色、阴影、高光和清线多层；一个发束穿插到不同深度时，应由模型拆成可判断的片段。标签不代表空间判断已经正确。

## 用经过点提交一笔

`paint_submit({commands:[...],animate:true})`；先读取现有 layer/stage ID。

```json
{
  "commands": [{
    "id":"cheek-left",
    "type":"stroke", "layer":"head-ink", "stage":"lineart",
    "objectId":"face", "subphase":"refine", "space":"face",
    "through":[[0.1,0.62,0.4],[0.25,0.8,1],{"anchor":"chin"}],
    "corners":[], "tension":0.8,
    "color":"#6b495d", "width":1.1,
    "endpoints":["occluded","joined"],
    "intent":"脸颊从手指遮挡处延伸至共享下巴节点"
  }],
  "animate":true
}
```

未启用平滑时，经过点在曲线上，拟合保留各点；启用平滑后，普通点是源几何定位依据，不保证最终曲线逐点经过。`corners:[索引]` 保留模型标记的转折。点可带压力；也可使用 `taper:[起笔,中段,收笔]` 按弧长分配压力。线条轻重应体现材质、轮廓与遮挡作用，不要每根线都套同一种压力模板。

仍支持 `path`（绝对 M/L/Q/C/Z，一条 path 只能有一次 M）、`control` 和手动 `points`。每次提交保留原始几何及稳定 ID。`closed` 用于模型明确选择的闭合曲线，不要给衣褶、发丝或遮挡处开放线强制闭合。`endpoints` 可为 open / occluded / joined / corner / contact。

回放沿弧长逐段运笔，有独立抬笔时间。`animate:false` 立即显示已提交的笔迹，之后仍可回放。播放期间不会重新调用模型推理。

## 局部修形、候选与遮挡

- `paint_get_strokes({objectId:"face",limit:200})`：读取笔迹 ID、原几何、采样结果、意图。也可按 region、layer、part、ids 筛选。
- `paint_edit_geometry({id:"cheek-left",index:1,point:[0.27,0.79,1],note:"修正脸颊中段弧度"})`：只移动一个源点，坐标仍属于原空间。
- `paint_edit_geometry({anchorId:"chin",point:[0.5,0.92],note:"调整下巴，保留相接关系"})`：共享点关联曲线一起更新。不要对引用锚点的槽位单独覆盖。
- `paint_edit_geometry({id:"cheek-left",trim:[0.05,0.95],note:"两端进入遮挡，保留中段"})`：按源曲线弧长裁切可见区间，保留源几何；这与把两段硬接起来不同。
- `paint_preview_revision({replace:[{id:"cheek-left",through:[...]}],region:[200,220,150,110],scale:3})`：不修改工程的候选试画。可比较 2–3 个方案，查看后用 `paint_revise` 提交选中的方案。
- `paint_revise({replace:[{id:"cheek-left",through:[...]}],note:"具体修订理由"})`：保留 ID 与顺序替换。也支持 remove ID 列表及 insert `{beforeId,commands}`。整个批次先验证，失败时原画布不变。

闭合的不可见边界使用 scene.regions，每项包含 `id,objectId,through`，可选 space/corners/purpose。遮挡使用 `occlusions:[{id,regionId,back,note}]`；region 所属对象是前景，back 是后景对象。在纯线稿中也会隐藏后方笔迹，不需要先涂底色。本轮用它处理双腿和鞋遮住尾巴、主发束遮住后卷、发饰遮住发线。

透明镜片不能作为不透明遮挡；镜框与镜片应为不同对象。区域及遮挡由模型明确组织，不能来自参考像素的自动分割。它们独立于图层显隐：隐藏前景线层不会自动移除其物体遮挡；查看被挡原线时需显式改关系或查看旧检查点。

基础关系提示不能发现所有漏口、错误交接、自交或人体形态问题，必须实际查看。

## 复核与检查点

每次局部完成后，先 `paint_playback({action:"finish"})`，再看画布和参考，记录具体观察。发现问题就修，修后再次查看。

```json
{
  "scope":"local", "kind":"observation", "objectIds":["face"],
  "region":[200,220,150,110], "status":"needs-work",
  "evidence":["drawing","reference","context"],
  "note":"下巴位置合理，但脸颊与发束交接偏窄，下一步调整中段经过点。",
  "issues":["脸颊与发束的负形偏窄"]
}
```

交给 `paint_record_review`。scope 为 local/global；kind 为 observation / structure-checkpoint / lineart-checkpoint；status 为 pass/needs-work。改动会令相关复核 stale，历史仍保留。

`paint_set_phase({phase:"refine"})` 启用规范流程；进入 refine/clean 不再要求先提交正式审核通过。完成清线后进入 1F `lineart_review`，第一轮实际检查结构与造型并记录全身 structure-checkpoint；第二轮检查边界、接头和线条质量并记录全身 lineart-checkpoint。两轮都查看实际画布、参考与缩小／翻转视图，缺口和泄漏工具辅助第二轮。两轮未通过前颜色提交会拒绝。旧版或非 1F 的记录保留，但不能替代本流程两轮审核。记录不是自动质量评分，不能为了让接口通过而编造观察。

`paint_checkpoint({action:"save",name:"结构修正后"})` 保存阶段；list 返回列表；restore 加 id 可恢复，恢复可撤销。最多 8 个检查点，工程中保留几何、图层和复核，不含参考像素。`paint_undo` 撤销文档操作。

## 区域与叠层

`paint_set_plan({layers,stages,masks})` 配置图层，layers 从下到上排列，最多 64 层。每个部位内可以依次放粗稿、底色、阴影、高光与清线层；真正层序由物体前后关系决定，绘画时间由 commands 决定。

阴影可用 `blend:"multiply"`、`clipTo:"下方底色层ID"`。masks 是模型规划的多边形选区；宽笔在选区内连续涂抹，不能靠参考逐像素补齐。

`paint_set_layers({layers:[{id:"head-ink",visible:false}]})` 只合成缓存，不重新执行笔迹或跳动时间轴。`hideAtCommand` 在该对象开始清线时自动隐藏对应粗稿；手动显示会取消该层自动隐藏规则。请不要把第一根清线出现当作全身粗稿验收。

## 文件

`paint_export_document` 返回可编辑工程。大工程通过分页读取，避免几何与历史检查点合并后超过浏览器消息限制：

1. `paint_export_document({section:"manifest"})` 获取场景、图层、复核和检查点清单。
2. `paint_export_document({section:"commands",offset:0,limit:80,compact:true})` 获取笔迹；按 `nextOffset` 继续。每页 revision 必须与 manifest 相同，否则重新导出。
3. 对每个检查点用相同方法附加 `checkpointId` 读取，再组装为该检查点的 doc。

compact 仅省略有源几何的笔迹采样缓存，导入时根据源几何重算；旧笔迹的采样点完整保留。页面的 JSON 下载仍直接导出完整工程。PNG 只包含当前可见绘画，参考图片单独保存。

局部复核窗口保留线稿和原图的全身对照，位置框与图片同步翻转。优先使用“髋—膝—踝—足”预设检查整条腿和鞋；不能只截出小腿判断。点击“整图对照”可切换为完整画面。

下一轮若继续细化，要保持本轮人体与足部关系，重点提高发束曲率、脸手表现和服装线条的审美精度；模型自主观察和选点的规则不变。任何改形都需要重新复核相关局部与整幅。


## 本轮新增：接头检查与撤回结论

`paint_check_connections({objectId:"right-arm",tolerance:1.25,limit:80})` 只检查可见清线已声明相接或遮挡的端点，返回坐标、距离和邻近笔迹。省略 objectId 检查全图。开放的发丝、衣褶和缝线另计，仍须目视检查；隐藏线不能充当可见接头。该工具不修改几何，不输入参考像素，也不自动判定艺术质量。页面有同名检查入口，可点提示进入局部对照。

最新有效的全身 needs-work 会撤回旧 pass，即使没有改坐标也会阻止上色。不能为了继续流程而伪造通过记录。脚皮肤、鞋帮、足床及两只衣袖均有独立对象与图层；绘画时要延续这些真实结构关系，不能只修改标签。


## 新增清线工具与分辨率



1. 读取 `paint_get_state`、`paint_get_scene`，确认图层、阶段与坐标。
2. `paint_playback({action:"finish"})` 显示全部笔迹。
3. `paint_scan_gaps({maxGap:10,angle:65,limit:120,subphases:["clean"]})`。
4. `paint_preview_leak({seed:[x,y],targets:[[outsideX,outsideY]],threshold:24})`。
5. `paint_get_diagnostics({includeImage:true,region:[x,y,w,h],scale:2})` 查看带标注局部；另看原图和全身。
6. 用 `paint_revise` 修形或补线；用 `paint_edit_pressure` 修改轻重。
7. 修改后重新检查，记录实际观察，不把工具返回成功当作线稿通过。

局部线宽示例：

```json
{
  "ids": ["existing-stroke-id"],
  "range": [0.3,0.6],
  "factor": 1.5,
  "feather": 0.05,
  "note": "加强这个接触边缘的中段，保留两端轻线和原有形状"
}
```

新增工具为 `paint_scan_gaps`、`paint_preview_leak`、`paint_get_diagnostics`、`paint_clear_diagnostics`、`paint_edit_pressure`。页面 JSON 面板同步支持 scan_gaps、preview_leak、edit_pressure、clear_diagnostics action。


新画布默认 1200 × 1600；PNG 导出默认 2×，从几何重新渲染，最长边 4096。R2 画布为 938 × 1997，2× 输出 1876 × 3994。旧工程坐标保持不变。完整说明见 drawing-tools.md。


### 曲线落笔与平滑
观察底稿与参考后先确定整条线的走势、最大弯曲处、两端方向及必要尖角，再提交足够而不过多的关键点。新笔迹可直接加 `smoothing: 0.5`；旧笔迹用 `paint_smooth_strokes({ids, smoothing})` 一次调整。省略或 0 保持原线，0 也可恢复已经平滑的原始轨迹。不新增预览、确认或审核工序，在已有局部与整体回看中判断效果。平滑保护端点、共享锚点、声明尖角，不能替代重画错误造型。
