# Line Atelier 项目指引

## 实际绘画任务

用户要求临摹、绘画、修线、上色或视觉验收作品时，在首次绘画操作前完整读取 [正式绘画规范](docs/WORKFLOW_PRINCIPLES.md)，简短说明已加载的来源。它维护核心原则；阶段要求单独维护在 `docs/workflow-stages/`，由程序按当前阶段返回；用户当前明确要求优先。

继续读取当前作品状态；工具用法按需查 [模型接口](app/docs/agent-guide.md) 和 [实际交互流程](docs/ACTUAL_DRAWING_WORKFLOW.md)。页面 `paint_get_state` / `window.paint.state()` 默认返回核心正文、当前阶段正文与各自哈希；进入阶段调用 `paint_set_phase` 后读取返回要求，恢复任务不省略核心正文；不要把历史作品记录当成本次实际观察。

## 开发与维护

修改代码、规范或测试不等于作画，无需为此执行绘画阶段或填写美术审核。实际源码在 `app/`，核心正文在 `docs/WORKFLOW_PRINCIPLES.md`，阶段正文在 `docs/workflow-stages/`。`archive/` 是历史资料，`dist/`、`downloads/` 与 `releases/` 是构建产物。

修改规范后运行 `npm run sync:protocol`，不要手改 `app/docs/workflow-principles.md`、`app/docs/workflow-stages/` 或 `app/drawing-protocol.generated.js`。`npm run dev`、`npm test`、构建命令也会同步。涉及接口或构建时运行适用测试及 `npm run build`；单文件版本用 `node scripts/build-r3-standalone.mjs` 生成。

本地源码修改与线上发布分别处理，按用户授权范围执行。操作说明维护在 `docs/workflow-actions/`，网页副本由同步脚本生成；`paint_inspect_context` 返回完整操作说明，落笔前读取。规范加载证据不等于绘画行为或美术验收，分别报告验证范围。
