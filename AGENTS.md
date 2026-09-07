# Line Atelier 项目指引

## 实际绘画任务

用户要求临摹、绘画、修线、上色或视觉验收作品时，在首次绘画操作前完整读取 [正式绘画规范](docs/WORKFLOW_PRINCIPLES.md)，简短说明已加载的来源。它是唯一维护的作画与质量标准正文；用户当前明确要求优先。

继续读取当前作品状态；工具用法按需查 [模型接口](app/docs/agent-guide.md) 和 [实际交互流程](docs/ACTUAL_DRAWING_WORKFLOW.md)。页面 `paint_get_state` / `window.paint.state()` 默认返回同源规范正文与哈希；不要把历史作品记录当成本次实际观察。

## 开发与维护

修改代码、规范或测试不等于作画，无需为此执行绘画阶段或填写美术审核。实际源码在 `app/`，规范正文在 `docs/WORKFLOW_PRINCIPLES.md`。`archive/` 是历史资料，`dist/`、`downloads/` 与 `releases/` 是构建产物。

修改规范后运行 `npm run sync:protocol`，不要手改 `app/docs/workflow-principles.md` 或 `app/drawing-protocol.generated.js`。`npm run dev`、`npm test`、构建命令也会同步。涉及接口或构建时运行适用测试及 `npm run build`；单文件版本用 `node scripts/build-r3-standalone.mjs` 生成。

本地源码修改与线上发布分别处理，按用户授权范围执行。规范加载证据不等于绘画行为或美术验收，分别报告验证范围。
