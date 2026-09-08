# CSP-11661 章节入口

这里仅负责路由。真正供模型读取和执行的是 `chapters/` 下的独立章节文稿，每章都包含连续讲解、原文对应图片、落笔步骤和完成检查。

## 起稿与定位

- [CSP-00 方法总览](chapters/CSP-00-overview.md)
- [CSP-01 结构与比例中线](chapters/CSP-01-structure.md)
- [CSP-05 动作指南](chapters/CSP-05-guides.md)

## 完整粗稿

- [CSP-02 创建参考形状](chapters/CSP-02-create-reference.md)
- [CSP-03 上半身](chapters/CSP-03-upper-body.md)
- [CSP-04 下半身](chapters/CSP-04-lower-body.md)
- [CSP-06 参考练习](chapters/CSP-06-reference-practice.md)
- [CSP-07 复杂草图](chapters/CSP-07-complex-sketch.md)

## 修稿与细化

- [CSP-08 线条质量](chapters/CSP-08-line-quality.md)
- [CSP-09 草图总流程](chapters/CSP-09-sketch-workflow.md)

运行中的绘画模型通过 `paint_get_reference_card` 按 `id` 读取同一份章节正文和对应本地图；无需让模型自行遍历目录。
