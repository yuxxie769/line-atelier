# 项目目录约定

`app/` 是唯一的运行源码：页面、绘画引擎、当前 R3 工程数据、参考图与界面所需说明均在这里。开发服务器以此目录为根目录。

`releases/` 保存可以直接交付或下载的单文件工作台。不要手工修改这些 HTML；使用相应的 `scripts/build-*-standalone.mjs` 重新生成。

`archive/` 保存早期试画、旧版工作台、旧版 JSON、导出图片和过程说明，仅供查阅、比较和审计，不参与当前应用或默认发布。

`dist/` 是发布暂存目录，由 `npm run build` 从 `app/` 与 `releases/` 生成，已被 Git 忽略。不要在其中修改源码。

## 日常命令

- `npm run dev`：从 `app/` 启动本地工作台。
- `npm test`：运行引擎测试。
- `npm run build`：生成可部署的 `dist/`。
- `node scripts/build-r3-standalone.mjs`：重建 R3 单文件工作台后，再运行 `npm run build`。
