# Line Atelier · v4 线稿研究

这是在 v4 工作台上改进的模型绘画接口。v5 仅参考流程和分区叠层理念；本轮线稿重新由模型观察参考并分批提交。当前示例仅完成第一阶段。

## 绘画流程

完整线稿 → 头发大色块 → 皮肤底色 → 服装大色块 → 配饰／鞋履底色 → 覆盖阴影 → 高光与整理 → 局部复核。

完整线稿内部：结构定位、主要轮廓、内部细节、局部校正。颜色层关闭后，线稿应独立成立。先检查整图，再观察脸、手、发束及衣褶局部。不要依据参考图像素生成自动分区、描边、补色或扫描笔迹。参考图仅供模型观察。

## 连接与观察

支持的浏览器通过 `document.modelContext.registerTool` 注册 WebMCP 工具。网页本身不调用模型 API；模型在支持 WebMCP 的浏览器里调用这些工具。普通浏览器可以手动画，或通过 JSON 面板及 `window.paint` 接口提交笔迹。

- `paint_get_state({})`：读取画布尺寸、当前阶段、图层、参考图权限和绘制状态。坐标始终是画布坐标。
- `paint_get_reference({})`：读取已允许访问的参考图。
- `paint_snapshot_region({region:[x,y,width,height],scale:1,source:"drawing"})`：原尺寸截图；`source:"reference"` 读取同位置参考，需要勾选允许读取。`scale:2` 只放大观察，不会创造原图不存在的细节。返回坐标换算。
- `paint_snapshot({maxSize:1024})`：整图缩略快照。

## 提交笔迹

`paint_submit({commands:[...],animate:true})`。

```json
{
  "commands": [{
    "id": "face-jaw-01",
    "type": "stroke",
    "layer": "head-ink",
    "stage": "lineart",
    "part": "下颌",
    "intent": "沿下颌转折收笔；在前发遮挡处结束",
    "path": "M 220 301 C 236 314 255 321 271 323 C 290 317 310 305 324 294",
    "color": "#715666",
    "width": 1.2,
    "taper": [0.2, 0.9, 0.1]
  }],
  "animate": true
}
```

一条 path 是一次落笔，只允许一个 M，支持绝对坐标 M、L、Q、C、Z。曲线控制点由模型决定，引擎只插值与渲染。`taper` 为起笔、中段、收笔压力。也支持 `points:[[x,y,pressure],...]` 或单段 `control`。笔迹 ID 保存在导出的工程中。

绘制以真实路径长度推进，有独立抬笔时间。`animate:false` 立即执行所提交的笔迹；之后仍可逐段回放这些笔迹。回放是已记录操作的重放，不表示模型在播放期间重新推理。

## 检查与修正

每完成一个相关结构，`paint_playback({action:"finish"})`，查看实际结果，再决定下一批。

- `paint_get_strokes({region:[x,y,w,h],layer:"head-ink",limit:200})` 找到待修改的 ID 和轨迹。可按 part 或 ids 筛选。
- `paint_revise({replace:[{id:"face-jaw-01",path:"M ...",width:1.1}],note:"说明实际观察到的问题"})` 替换指定笔迹，不更换其 ID 或绘制顺序。remove 为 ID 列表；insert 为 `{beforeId,commands}` 列表。整个批次先验证，失败不修改画布；成功只重绘受影响图层。会先完成正在播放的已提交笔迹。
- `paint_record_review({region:[x,y,w,h],note:"实际观察",kind:"observation"})` 保存观察；`lineart-checkpoint` 表示人工或模型记录的检查节点，不是自动质量评分。
- `paint_undo({})` 撤销最近操作。

## 部位与叠层

`paint_set_plan({layers,stages,masks})` 定义图层、顺序和模型给出的区域轮廓。已有笔迹引用的 ID 需要保留。layers 数组从下到上排列，最多 64 层；时间顺序由 commands 决定。

`group` 区分后发、前发、身体、外套、手等前后部位；`role` 记录草稿、底色、阴影、高光、线稿用途。每个部位内可按底色 → 阴影 → 高光 → 线稿叠加。阴影使用 `blend:"multiply"`、`clipTo:"对应底色层ID"`。底色层必须在剪贴层下方。前发与后发需要分开。

`paint_set_layers({layers:[{id:"head-ink",visible:false}]})` 修改显隐、锁定、透明度等。显隐只合成缓存，不重新执行笔迹，保留时间轴位置。图层分组支持折叠和整组显隐。`hideAtCommand` 可在指定笔迹开始时自动隐藏结构稿；用户主动显示该层会取消这一自动规则。

区域 masks 为模型规划的多边形边界，不从参考像素自动提取。底色仍使用宽笔沿形状涂抹；区域只约束边缘。当前纯线稿示例不需要颜色区域，也未执行后续上色阶段。

## 保存

`paint_export_document({})` 返回完整工程及复核记录。界面可导出 PNG 和工程 JSON。参考图单独保存，PNG 不包含参考叠加。示例含 321 条记录，其中 9 条是结构定位，312 条为最终线稿笔迹。
