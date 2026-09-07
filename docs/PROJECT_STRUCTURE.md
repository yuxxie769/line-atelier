# 项目目录约定

`app/` 是唯一的运行源码：页面、绘画引擎、当前 R3 工程数据、参考图与界面所需说明均在这里。开发服务器以此目录为根目录。

`releases/` 保存可以直接交付或下载的单文件工作台。不要手工修改这些 HTML；使用相应的 `scripts/build-*-standalone.mjs` 重新生成。

`archive/` 保存早期试画、旧版工作台、旧版 JSON、导出图片和过程说明，仅供查阅、比较和审计，不参与当前应用或默认发布。

`dist/` 是发布暂存目录，由 `npm run build` 同步规范、重建 R3 单文件版后从 `app/` 与 `releases/` 生成，已被 Git 忽略。不要在其中修改源码。

绘画规则仅在 `docs/WORKFLOW_PRINCIPLES.md` 维护。`app/docs/workflow-principles.md` 与 `app/drawing-protocol.generated.js` 由 `scripts/sync-drawing-protocol.mjs` 生成，后者供状态工具和复制绘画要求使用。修改后运行 `npm run sync:protocol`；开发启动、测试与构建也会同步。正在运行的开发页面在同步后刷新即可使用新版本。

仓库根 `AGENTS.md` 是项目作画入口。当前迁移目录的外层 `AGENTS.md` 仅指向真实仓库，不属于 Git 交付；从其他位置使用时应以本仓库作为项目根目录。旁边的 `source/` 是旧快照。

## 日常命令

- `npm run dev`：从 `app/` 启动本地工作台。
- `npm run sync:protocol`：从统一规范生成网页和接口正文。
- `npm run check:protocol`：只读检查生成内容是否与规范一致。
- `npm test`：运行引擎测试。
- `npm run build`：生成可部署的 `dist/`。
- `node scripts/build-r3-standalone.mjs`：只重建 R3 单文件工作台；`npm run build` 也会自动执行这一步。
