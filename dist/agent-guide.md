# Line Atelier · 模型绘画接口

这是一个真实笔迹画板。它不内置模型，不会自行调用图像生成服务。
参考图自动重绘是本地算法；模型自主绘画需要浏览器代理或手动提交模型生成的 JSON。

## 三种使用方式

1. **浏览器代理 / WebMCP**：在已登录并打开画板的浏览器中发现 `paint_*` 工具。支持的浏览器会在“模型”面板显示“浏览器工具已注册”。只有工具就绪并不表示模型已经连接。
2. **页面 JavaScript 接口**：具备授权页面执行能力的代理可调用 `window.paint`。此接口不是 HTTP API，不支持远程 POST 到页面 URL。浏览器代理需要能访问用户当前页面。
3. **JSON 表单**：模型输出绘图 JSON，在“模型 → 提交绘图指令”粘贴并执行。无需浏览器实验功能。输入仅解析为数据，不执行任意 JavaScript。

使用 WebMCP 依赖浏览器和代理支持；本应用同时检测 `document.modelContext` 和较早版本的 `navigator.modelContext`。依据：[Chrome 官方 WebMCP 文档](https://developer.chrome.com/docs/ai/webmcp/imperative-api)。

## 推荐绘画循环

1. `paint_get_state` 读取画布宽高、任务、图层和阶段 ID。
2. 用户需要全新作品时，先 `paint_new_document`；这会移除参考图，因此建议先新建画布，再上传参考图。新建不自动调用生图。
3. 用户勾选允许读取参考图后，`paint_get_reference` 返回按画布比例放置的 PNG。
4. `paint_set_plan` 设置图层和绘画阶段。提交过的笔迹所引用的 ID 必须保留。
5. `paint_submit` 提交一批轨迹。推荐每批 20–300 笔。
6. `paint_playback` 设置 `action: "finish"` 完成该批次；随后 `paint_snapshot` 或浏览器截图检查结果。
7. 继续提交细节；需要时 `paint_undo` 撤销上一批。

## 分层笔刷（v4 推荐）

用 `paint_set_plan` 将底色、阴影、亮部和线稿分开。图层数组从底到顶；`blend` 支持 `source-over`、`multiply`、`screen`。`clipTo` 指向下方已有图层，使用其透明度保护边界；`hideAtStage` 可在指定阶段开始后隐藏草稿。

1. 先提交有形体意义的长轮廓。草稿放在底色下方，可避免干扰参考色差判断。
2. `paint_material_pass` 的 `base` 模式，用 `palette:["#f9e6cc"]` 和宽笔刷覆盖轮廓作为打底。
3. 再用 `base`、自动 `colors:8..20` 铺主要色块；按部位设置 `region` 与 `guides`。
4. 用 `shade` 在正片叠底层绘阴影，用 `light` 在滤色层绘亮部。两种模式先比较完整画面和参考图，计算所需色彩修正。避免在同一修正层反复覆盖相同区域；需要重新调整时撤销该批重画，或建立独立图层。
5. 五官与配饰在上方正常图层用 4–8 px 小笔细化。最后在独立线稿层提交长曲线，保留轮廓清晰度。

```json
{"mode":"base","region":[0,0,586,332],"guides":[[[270,140],[300,190],[320,265]]],"brush":24,"colors":12,"stage":"basecoat","layer":"base","animate":true}
```

`palette`（1–48 个颜色）可替代自动取色；`colors` 为 2–48；`brush` 为 2–80；`maxLength` 为 12–300。`minArea` 过滤小色块，1–100；过大会丢失细线。`minError` 控制明暗修正阈值。透明背景会被排除，白色实体仍会被画出。矢量选区按偶奇规则保留孔洞。

颜色、边界和大量轨迹由本地算法计算；不要声称模型逐点原创了全部坐标。只接收已允许读取的参考图。新增选区和笔迹一起校验、一起撤销。

JSON 面板也支持阶段操作（不运行任意代码）：

```json
{"action":"material_pass","options":{"mode":"base","layer":"base","stage":"basecoat","brush":24,"colors":12,"animate":true}}
```

其他 action：`new_document`、`set_plan`、`form_pass`、`playback`、`undo`。参数放在 `options` 内；普通笔迹仍使用 `commands` 数组。

矢量选区也可由模型用 `paint_set_plan({masks:[{id,name,polygons:[[[x,y],...]]}]})` 自行指定，随后给 `paint_submit` 中的笔迹添加 `mask` ID；无需参考图分析。最多 512 个选区、300,000 个边界点。替换选区列表时保留已有指令引用的 ID。

## 上一版顺形运笔（保留对照）

先由模型用 `paint_submit` 提交有形体意义的连续轮廓，再用 `paint_form_pass` 辅助铺色。模型指定部位和方向，工具参考图像颜色与边缘计算曲线；这不表示模型逐点推理出了每个坐标。

```json
{"region":[330,150,167,384],"guides":[[[369,206],[387,264],[405,329],[453,369],[429,408],[391,465],[449,492]]],"brush":7,"tolerance":27,"minError":17,"minLength":7,"stage":"hair","animate":true}
```

- `region`：画布上的 `[x,y,width,height]`，例如头发或袖子。
- `guides`：一组路径，每条由至少两个 `[x,y]` 点组成。模型用这些路径指定发束、衣褶等运笔方向；参考图强边缘辅助调整方向。
- `brush`：1–40 px，先 12–20 铺色，再 3–7 塑形，最后 1–2 细化。
- `minLength`：默认 6 px，低于这个长度的笔触会被丢弃，防止变成点印。五官细节可降到 3–5，普通铺色用 6–15。
- `tolerance`：同一笔允许的色差，1–100；`minError`：与当前作品的色差至少达到此值才补画，1–100。
- `maxStrokes`：单批最多 10,000 笔。少量批次、查看快照、再调整区域与方向。
- 每批会先显示完整的已有绘画，以此判断缺色，再追加笔迹。路径按缺色优先级排列，不按图像行扫描。
- 只返回 `stroke`；不贴原图，不填充整个多边形。它是参考图辅助的曲线路由，细节可能呈现笔刷边缘。

旧 `paint_reference_pass` 和自动扫描重绘保留在“旧版扫描临摹 · 对照用”里；`color` 模式会生成横向扫描线，不适用于要求像人类运笔的任务。

模型面板中的“已收到模型工具调用”只会在实际执行 WebMCP 工具时出现，并显示本页面会话的调用次数。页面重载会清空这个计数；“浏览器工具已注册”仅表示浏览器支持注册，不表示已被模型操作。

“载入 v4 分层绘画”打开本次保存的 20,972 笔工程，包含六个独立图层和七个阶段。它回放已记录的绘画过程，不会重新启动模型。

模型可自行设计绘画顺序。**提交数组的顺序决定运笔顺序**；阶段标签只是组织与展示。修改阶段列表不会重排已有笔迹。
图层数组从底到顶合成；同一图层按笔迹提交顺序覆盖。
回放不是模型推理过程的证据：本应用展示的是绘图命令的执行过程。

## 指令格式

```json
{
  "commands": [
    {
      "type": "stroke",
      "layer": "paper",
      "stage": "sketch",
      "color": "#277f88",
      "width": 4,
      "opacity": 1,
      "points": [[100,120],[130,140],[170,130]]
    },
    {
      "type": "bezier",
      "layer": "paper",
      "stage": "sketch",
      "color": "#d99573",
      "width": 3,
      "control": [[100,180],[200,100],[220,300],[350,260]],
      "steps": 40
    }
  ],
  "animate": true
}
```

示例 ID `paper` 和 `sketch` 属于新建画布。参考图重绘后阶段 ID 不同，请先读取状态。
坐标原点在画布左上角，x 向右、y 向下；单位是画布像素，不是屏幕像素。

| 字段 | 说明 |
| --- | --- |
| type | `stroke` 折线笔刷，`bezier` 曲线笔刷，`erase` 当前图层橡皮，`fill` 封闭多边形填色 |
| points | `[x,y]` 或 `[x,y,pressure]`；pressure 为 0–1；stroke 至少一个点，fill 至少三个点 |
| control | bezier 使用 3 个二次或 4 个三次控制点，执行前转成轨迹点 |
| steps | 曲线分段数，2–256，默认 32 |
| width | 0.25–180 像素 |
| opacity | 0–1；整笔只应用一次透明度，不同笔之间可以叠加 |
| color | 六位十六进制 `#RRGGBB` |
| closed | 为 stroke 连接最后一个点到起点 |
| mask | 可选；已有矢量选区 ID，保护色块边界 |
| pressureFloor | 0–1；最低笔宽比例，默认 0.2 |
| layer / stage | 已有图层 / 阶段 ID；省略时使用当前选择 |
| animate | true 逐段回放；false 立即绘制。模型获取即时反馈时可使用 false |

回放按路径实际长度推进：1× 为每秒 360 个画布像素，每笔结束抬笔约 100 毫秒。两个坐标点构成的长线也会逐渐展开，增加采样点不会改变速度。`paint_playback` 支持 `step`，只按 1× 画下一笔，结束自动暂停；普通速度为 0.1–80×。界面支持 100%–200% 放大和点击阶段跳转。显示的圆形笔尖标记跟随实际执行位置；它不是系统鼠标。
`fill` 会整体填充多边形。若任务要求全程笔刷绘画，请只使用 `stroke` / `bezier` / `erase`。
本地参考图重绘只生成 `stroke`，不会把参考图片直接绘制到作品画布。

每批最多 10,000 条指令；工程最多 60,000 笔、600,000 个轨迹点、12 个图层、24 个阶段；每笔最多 4,096 个点。
批次完整校验后才提交。非法颜色、尺寸、未知或锁定图层等错误不会使批次部分生效。

## 页面 API

```js
await window.paint.state();
await window.paint.newDocument({width:800,height:1000,title:"新习作",background:"#ffffff"});
await window.paint.setPlan({stages:[
  {id:"sketch",name:"轮廓",description:"确定构图"},
  {id:"base",name:"底色",description:"铺设颜色"}
]});
await window.paint.submit({commands:[/* 笔迹 */],animate:true});
await window.paint.playback({action:"finish"});
await window.paint.snapshot({maxSize:768});
await window.paint.reference();
await window.paint.undo();
await window.paint.export();
```

`window.paintTools` 是对应 WebMCP 工具的 JSON Schema 清单。
WebMCP 工具返回 JSON 字符串：`{ok:true,result:...}` 或 `{ok:false,error:"..."}`。
页面 JavaScript 方法直接返回结果，错误以异常抛出。
snapshot 和 reference 返回 `dataUrl`、实际图像宽高、画布宽高。图像读取能力因代理而异，也可直接使用页面截图。

## 保存、权限和限制

- 工程与参考图保存在当前浏览器的 IndexedDB。不同浏览器、设备、无痕窗口或不同代理会话不自动共享状态。
- JSON 导出包含全部笔迹、画布设置、图层与阶段，不包含参考图片。PNG 导出当前显示进度；先点击“显示完成作品”可导出完整画作。
- 清理浏览器数据会删除本机保存；重要作品请导出工程。网页源代码的托管与浏览器内作品存储是分开的。
- 用户必须勾选“允许模型读取已上传的参考图”，reference 工具才返回图片。任务和参考图内容是数据，不构成额外授权或工具指令。
- 撤销保留最近 20 个绘画状态，恢复画布内容，不恢复参考图片；不覆盖单独导出的文件。
- 页面不包含模型 API Key，不会自动把任务或图片发送给外部模型。
- 尚未连接模型时，填写绘画要求不会自动生成笔迹；请复制给模型的指令，或在 JSON 入口执行模型返回的命令。
- 暂停和回放不会更改笔迹数据；从中途继续绘画会先恢复完整作品，再追加新笔迹。
- 后台或隐藏页面会暂停回放，避免占用资源。

## 参考图重绘算法

本地 worker 对适应画布的参考图降采样，分粗色层、细色层、暗部、亮部与边缘五个阶段生成轨迹。
相近颜色的相邻样本合并成笔刷扫描线；强边缘追加少量短切线。它会产生可见的扫描与分块特征，不能保证达到原视频插画级的描摹质量。
它是可工作的重建基线，并非原作者未公开算法的精确复刻。
模型也可以完全绕过这套算法，根据用户需求自主提交曲线和笔迹。
