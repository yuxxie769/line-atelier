# Line Atelier

一个无框架、无服务端依赖的 Canvas 2D 绘画工作台，使用 ES modules。
静态站点源文件在 `dist/`，通过 Sites 保存与发布。

- `model.js`：文档、笔迹校验、曲线采样、示例指令。
- `engine.js`：分图层 Canvas、逐段执行、回放、撤销。
- `trace-worker.js`：图像转笔触的本地算法基线。
- `app.js`：界面、设备内保存、文件输入输出、模型工具桥接。
- `agent-guide.md`：完整模型接入说明，随站点提供。

浏览器需要支持 ES modules、Canvas 2D、Web Workers。没有 WebMCP 时仍可使用 JSON 表单或页面 API。
没有内置 LLM，不包含任何密钥或收费 API。

验证：`npm test`。静态发布无需构建。
