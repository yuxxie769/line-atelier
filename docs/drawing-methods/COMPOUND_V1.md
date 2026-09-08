# 三号复合笔组 v1（3.1.0）

2026-09-09 经用户确认定型。进入 refine、clean、lineart_review 后，本方法对复杂轮廓是强制提交协议；正文随 `paint_get_state` / `paint_set_phase` 的 `drawingProtocol.compoundMethod` 注入，不代表作品质量已通过，也不替代当前绘画阶段要求。

## 固定规则

1. 模型先观察参考与同部位底稿，决定完整意图轮廓、转折和局部轻重。复杂轮廓可有少量方向不连续的小转折；不添加随机抖动、不机械等距碎分、不把所有曲线磨圆。
2. 新增轮廓使用 `paint_submit.compoundGroups`，替换现有轮廓使用 `paint_revise.compoundReplace`。模型输出一条局部 `path`、1–2 个有结构原因的接点 `lifts`、全局 `pressureProfile`、最大线宽及端点关系。普通局部每组生成 2–3 笔。
3. 程序计算实际分笔端点、短搭接和笔尾压力。默认搭接 5 个画布像素，可依比例明确调整；接点太近时自动缩短，不移动源中心线，不重新拟合或平滑。
4. 接头处保留目标线宽；旧笔尾逐渐变细，新笔在接点前恢复目标线宽。生成后不手改采样点；如需改形，修改模型源输入并重新生成。
5. 画后检查参考、底稿与结果：轮廓是否保留或改善、必要折向是否还在、有没有断缝、细腰、黑结、双边，以及缩回整体是否协调。转折角度与笔数不是质量分数。

脸、衣袖和鞋不使用同一套压力数值。固定的是上述方法，不是坐标、角度、线宽和分笔数量。

## 可复用实现

`scripts/drawing/compound-v1.mjs` 导出 `compileContourV1(input, doc)`，返回版本、解析后的源输入、实际笔迹及接头记录。内核从用户认可的膝部试验冻结，显式拒绝额外平滑。

```js
const result = compileContourV1({
  stroke: {
    id: 'edge', path: 'M 10 10 Q 20 20 30 20 Q 40 18 50 10',
    width: 1.5, opacity: 1, smoothing: 0, pressureFloor: 0,
    pressureProfile: [[0, 0.5], [0.5, 1], [1, 0.4]]
  },
  lifts: [{point: [30, 20], reason: '鼓起后转入收束'}],
  overlapPx: 5,
  roles: ['silhouette', 'turn']
}, doc);
```

实际使用补齐当前文档的图层、阶段、部位、颜色和端点关系。`point` 须唯一对应路径采样顶点；不能静默吸附到附近坐标。路径中的贝塞尔控制点不是经过点。

## 当前能力边界

仅支持不透明开放线、线性压力、无额外平滑及 widthEdits 的输入；不处理透明叠加增黑、笔尖倾角或纸纹。二维路径采样不是三维曲面理解。

正式网页工具已接入编译与提交门槛。refine、clean、lineart_review 的普通线必须声明 `contourMode:"simple-sweep"` 与 `simpleSweepReason`；检测为长而复杂时仍会被拒绝并要求改用本方法。程序只能核验声明、几何候选、生成方式和实际笔数，不能代替模型判断参考里的转面与遮挡；离线试画也不能冒充网页逐批绘画与正式验收。

基准：`studies/20260909-local-turn-trial/results-scheme3/`。新三部位试画：`studies/20260909-compound-v1-three/`。
