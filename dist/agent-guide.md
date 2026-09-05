# Line Atelier · v4 人体先行与全身清线

基于 v4。v5 仅作为流程与区域叠层理念参考。网页不内置模型；支持 WebMCP 的浏览器可让模型直接操作工具，普通浏览器可手动画或使用 JSON 面板。完整工作规范见仓库 `docs/DRAWING_WORKFLOW.md`。

当前作品是 `body-first-study.line.json`，可下载 `line-atelier-v4-body-first-full-lineart.html`。652 条记录包含 29 条人体构造线、328 条保留草稿和 295 条全身独立清线，6 个检查点保留旧稿、结构重画及全身终审。最终阶段为 `lineart_review`；本轮结构与清线检查完成，不代表已经达到原视频的商业插画精度。

## 绘画纪律

完整线稿 → 头发大色块 → 皮肤底色 → 服装大色块 → 配饰／鞋履底色 → 覆盖阴影 → 高光与整理 → 局部复核。

线稿内部：`layout` 整体定位 → `rough` 完整粗稿 → `structure_review` 结构修稿与全身复核 → `refine` 细化草稿 → `clean` 独立清线 → `lineart_review` 清线后的全身复核。

先建立衣物下的完整人体：头、胸廓、骨盆、肩肘腕、髋膝踝以及足部的落点，再围绕人体画衣服、头发和配饰。人体构造层保留为辅助，最终隐藏。

每个物体也从大形到细节。画完一个小结构就看画布、同位置参考和相邻结构；先修比例和体积，再处理线条轻重、接头和闭合。粗稿允许试探，清线需要选择和重画，不是把所有旧线统一描深。二次元比例以参考风格为准，不套用固定头身比。

参考线稿提取仅用于观察。禁止把提取像素、轮廓或分区自动转换为画布路径、选区和上色轨迹。模型根据观察自行选择几何；算法只负责这些几何的插值、编辑与渲染。上色也应组织连续宽笔与区域叠层，不进行像素差值补丁。

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

经过点在曲线上。拟合保留各点，`corners:[索引]` 保留模型标记的转折。点可带压力；也可使用 `taper:[起笔,中段,收笔]` 按弧长分配压力。线条轻重应体现材质、轮廓与遮挡作用，不要每根线都套同一种压力模板。

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

`paint_set_phase({phase:"refine"})` 启用规范流程；进入 refine/clean 前需有效的全身 structure-checkpoint。完整清线后进入 lineart_review，实际查看无草稿的全身、参考与翻转视图，再记录全身 lineart-checkpoint。未通过前颜色提交会拒绝。记录不是自动质量评分，不能为了让接口通过而编造观察。

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
