# Line Atelier · v4 R3 底稿与平滑整合版

模型通过浏览器工具观察参考、读取底稿坐标、提交自己选择的笔迹，并根据实际渲染修订。页面负责几何、平滑、压力、Canvas 合成、编辑与回放，不内置模型推理服务。

当前可维护的工作台位于 `app/`，默认 R3 半身线稿保留 361 条笔迹及七个检查点。`dist/` 是由 `npm run build` 生成的部署目录；单文件工作台在 `releases/`，早期实验和版本档案在 `archive/`，它们都不作为当前应用入口。

## 当前文档

- [实际绘画交互流程](docs/ACTUAL_DRAWING_WORKFLOW.md)
- [全部平台功能与 29 个 WebMCP 工具](docs/PLATFORM_FEATURES.md)
- [正式指令与落笔依据实施规划](docs/DRAWING_IMPLEMENTATION_PLAN.md)
- [统一绘画规范与质量标准（在这里修改）](docs/WORKFLOW_PRINCIPLES.md)
- [规范入口与加载验证](docs/DRAWING_PROTOCOL_VALIDATION.md)
- [既有绘画工作规范](docs/DRAWING_WORKFLOW.md)
- [模型接口使用说明](app/docs/agent-guide.md)
- [自动本地会话日志](docs/LOCAL_SESSION_LOGS.md)
- [目录与发布约定](docs/PROJECT_STRUCTURE.md)

`paint_inspect_context` 默认一张对照图与精简坐标，`detail:"full"` 按需获取完整内容；不增加人工入口，不限制如何绘画。新笔迹可附带 `smoothing`，旧笔迹用 `paint_smooth_strokes` 单次调整，设为 0 恢复源轨迹。

正式规范统一维护于 `docs/WORKFLOW_PRINCIPLES.md`。仓库 `AGENTS.md` 指向该正文，网页 `paint_get_state` / `window.paint.state()` 默认返回同源规范全文及哈希；网页文档和复制绘画要求自动同步。修改后运行 `npm run sync:protocol`，不要手改生成的副本。实际加载验证与边界见上述记录。

批次已支持可选 `basis`，独立会话记录关联实际读取、修改和结果图，并可分页导出。[R3 左眼真实试画](docs/R3_LEFT_EYE_TRIAL.md) 已完成，含可编辑副本和原始观察图；原 R3 未覆盖，局部试画不代表整幅重新验收。

## 自动保存模型会话日志

用 `npm run dev` 启动工作台并通过 `http://127.0.0.1:5173/` 使用时，每个模型会话会自动完整保存到 `logs/sessions/<sessionId>.json`。日志包含工具调用参数、返回结果、绘画修改、会话证据图片，以及人体参考卡的章节/图片读取溯源；每次实际返回图片还会记录读图完成时间，以及到下一次模型工具调用开始的毫秒间隔。它独立于作品工程文件，且 `logs/` 不进入 Git。

浏览器 IndexedDB 仍保存会话副本：启动时会补写此前保存的会话，临时写入失败会每 15 秒重试。页面状态和 `paint_get_state.localEvidence` 会显示本地归档是否已保存；也可以通过 `paint_export_document({section:"evidence"})` 分页读取或导出。静态部署和单文件 HTML 没有本地服务时，仍可使用 IndexedDB 与手动导出，但不会自动落盘。完整约束和存储行为见[自动本地会话日志](docs/LOCAL_SESSION_LOGS.md)。

构建部署目录：`npm run build`（自动同步规范并重建 R3 单文件版）。单独重建 R3 单文件版：`node scripts/build-r3-standalone.mjs`。现有测试入口为 `npm test`。当前入口不运行仓库历史自动描图实验。
