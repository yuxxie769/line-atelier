# Line Atelier · v4 R3 底稿与平滑整合版

模型通过浏览器工具观察参考、读取底稿坐标、提交自己选择的笔迹，并根据实际渲染修订。页面负责几何、平滑、压力、Canvas 合成、编辑与回放，不内置模型推理服务。

当前可维护的工作台位于 `app/`，默认 R3 半身线稿保留 361 条笔迹及七个检查点。`dist/` 是由 `npm run build` 生成的部署目录；单文件工作台在 `releases/`，早期实验和版本档案在 `archive/`，它们都不作为当前应用入口。

## 当前文档

- [实际绘画交互流程](docs/ACTUAL_DRAWING_WORKFLOW.md)
- [全部平台功能与 29 个 WebMCP 工具](docs/PLATFORM_FEATURES.md)
- [正式指令与落笔依据实施规划](docs/DRAWING_IMPLEMENTATION_PLAN.md)
- [用户确认的工作流与质量标准](docs/WORKFLOW_PRINCIPLES.md)
- [既有绘画工作规范](docs/DRAWING_WORKFLOW.md)
- [模型接口使用说明](app/docs/agent-guide.md)
- [目录与发布约定](docs/PROJECT_STRUCTURE.md)

`paint_inspect_context` 默认一张对照图与精简坐标，`detail:"full"` 按需获取完整内容；不增加人工入口，不限制如何绘画。新笔迹可附带 `smoothing`，旧笔迹用 `paint_smooth_strokes` 单次调整，设为 0 恢复源轨迹。

正式规范的固定加载及完整按组执行证据尚属实施规划。现有意图、复核文字和功能测试均不能替代真实读图—落笔—复看记录。

构建部署目录：`npm run build`。重建 R3 单文件版：`node scripts/build-r3-standalone.mjs`。现有测试入口为 `npm test`。当前入口不运行仓库历史自动描图实验。
