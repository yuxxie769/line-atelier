# Line Atelier

一个无框架、无服务端依赖的 Canvas 2D 绘画工作台，使用 ES modules。
静态站点源文件在 `dist/`，通过 Sites 保存与发布。

- `model.js`：文档、笔迹校验、曲线采样、示例指令。
- `engine.js`：分图层 Canvas、逐段执行、回放、撤销。
- `trace-worker.js`：图像转笔触的本地算法基线。
- `reference-passes.js`：让模型选择区域与参数的分批参考图笔刷临摹。
- `reference-study.line.json`：由浏览器 WebMCP 实际生成并导出的参考图习作。
- `app.js`：界面、设备内保存、文件输入输出、模型工具桥接。
- `agent-guide.md`：完整模型接入说明，随站点提供。

浏览器需要支持 ES modules、Canvas 2D、Web Workers。没有 WebMCP 时仍可使用 JSON 表单或页面 API。
没有内置 LLM，不包含任何密钥或收费 API。

验证：`npm test`。静态发布无需构建。

浏览器测试使用 Vite 开发入口，静态发布仍直接使用 `dist/`。网页注册九个 WebMCP 工具；当前测试已实际验证提交笔迹、参考图分批临摹、读取快照和回放。工具作用于所在浏览器页面，不会同步操控其他设备上的同名页面。
