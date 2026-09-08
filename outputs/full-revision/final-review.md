# 1F 第二轮清线审核：最终独立复核

- 阶段：1F 第二轮内部，返修后的最终复核；当前程序 phase=refine 不作为美术不通过依据。
- 审核者运行 ID：/root/lineart_final_review（宿主任务路径，非平台认证签名）。
- 画布 revision：112。
- 结论：**pass**；明确 major：0；总体 confidence：0.86。
- 可回到 1F 按既有程序完成最终记录；本报告不代替当前 observationIds、阶段检查与诊断记录，也未修改画布或流程状态。

## 独立观察顺序

完整读取核心原则、lineart_review.md 和 agent-review.md。先看 r112 full 参考/画布及 mirror 参考/画布，再看 costume、face、wrist、shoe、body 全部对照；形成“主要交界成立、服装有有效结构依据、尚有局部简化但未见明确 major”的独立判断后，才读取 initial-review.md 与 corrective-changes.md。随后补看 r104 full-drawing，仅用于验证变化。14 张 r112 文件均经 SHA256 实算核对，与 manifest 一致。

## 达标的正面图像证据

1. 整图及镜像：遮眼前发、侧辫、光环、宽领及胸前领结仍保留；交叉腿的遮挡和坐姿负形与参考对应。上身至腰部、裙边至弯腿、长发压住右袖及后摆的关系连续。未见清线引入主要比例或前后次序破坏。细节较参考简约，但单靠简约不足以证明主要角色特征失去。
2. 服装：腰部短褶现在接至衣身下缘，向膝上布面展开；腰下到裙边能沿主褶追踪布面走向。侧裙折回与下缘的第二条边明确表示厚度。左搭袖的上部布面曲线与下侧折回相呼应，外缘下坠转折接住内褶。后衣摆中央弯折有上缘、下缘和右端转回，底部线沿外缘回折，形成相互错开的层。读得出压住后展开的布料，已超出只分割封闭轮廓的状态。
3. 袖腕：wrist 局部中袖口前缘为下方弧边，上方平行线表示口缘厚度；腕/手外缘在前缘处起止，未贯穿袖管。手指从袖下向袜口小椭圆收拢，连接点位于袖下，符合参考的抓持位置；有限可见面积不支持凭空补全手掌。
4. 鞋踝：shoe 局部腿两侧止于鞋口，前方舌片拱起遮住足背，后侧鞋帮升高形成后跟容纳处；两条绑带跨足背，前掌弧与底边平行但有间距，底厚可读。后跟侧片比参考尖，仍保持后跟—足背—前掌的同一方向，未造成脚从鞋侧穿出的关系。
5. 颈领：face/costume 中颈圈两弧围住颈部，下方颈前区域到前领面之间有独立斜边；侧发在前，颈边于遮挡处消失；领结结点独立，飘带在前领下落，没有领边穿过发束。下颌已接至侧发边。
6. 清线：主轮廓连续，内部褶线大多开放收轻；裙边及部分折返比内线更重。没有大范围重复试探线、毛刺或未决草线。长发与袖的交界没有可证明的新增误接。

## 初审逐项复核

### M1 服装结构共同平面化

结果：**已解决至本阶段容差**，原 severity=major，当前残余 severity=minor，confidence=0.85。

参考需要束腰到膝上布面展开、左搭袖坠落折返、后摆受压后层叠。r112 腰褶起点接到衣身下缘，主折线贯通裙面，侧边与底边增加可追踪折层；左袖在约 x110–246/y386–452 有连续下坠—折回节奏，曲线端点贴合折边而非两条孤线；后摆约 x429–565/y528–651 的中央层有下缘和右端回折，底层向下外缘翻回，不再三条平行横划。对照 r104 能确认上述改变。

裙面仍比参考宽缓，后摆仍几何化，未重现所有细褶；但三处已各有受力、折返或层厚依据，放回整图不再共同只能读成无厚度分割片。没有足够具体的联合损失证据继续定 major；该判断不依赖未上色，也不以添线数作为完成度。

### m1 抬手指节机械

结果：**保留 minor**，confidence=0.88。参考可见指尖长短及弯曲不同；当前手指仍近似平行带状弧。袖内腕根到脸前指尖的归属成立，没有新增穿线，影响限于局部自然感，不阻断。建议以后细化指尖与被遮结束，非本次通过前强制返工。

### m2 线重层次弱

结果：**部分改善、保留 minor**，confidence=0.90。裙边、左袖折回与后摆中央下缘已比提示线重，内褶有较轻收笔；全图头发和部分衣缘仍偏均匀。无需整体描粗，当前足以区分主要轮廓和结构提示。

### m3 下颌/发束接头

结果：**已解决**，severity=none，confidence=0.94。face 局部下颌斜线实际终止于面侧发束边，无原先可见缝隙，也未延长穿过头发。

### u1 下垂手掌指细节

结果：**不确定性缩小，仍保留 uncertain**，confidence=0.72。腕根当前抵达袖口下缘；参考的可见手部同样很小，袖下几根线向袜口收拢的动作可对应。无法可靠将每根细线命名为具体掌指解剖，未观察到足够证据支持 major。不要把本项写为掌指细节完全还原。

## 新问题与回退检查

未发现新增 major。新留意项 n1：右后衣摆底部翻回约 x475–532/y620–652 较参考更尖、更规整，severity=minor，confidence=0.82；位置仍在后方，不改变与袖、腿的归属。该项与残余褶皱概括不能仅按数量升级。

未见此次接线破坏下颌/发束遮挡、腕根穿袖或修改裙边时损坏膝腿遮挡。抬手、鞋和主要发型未因此次局部返修新增明显退步。

## 证据范围

此次直接查看当前整图、镜像、五组局部，共14张。旧稿仅辅助确认变化。未运行新的泄漏/缺口诊断，初审 r104 的诊断不冒称 r112 结果；因此 pass 是本次独立视觉复核结论，主 agent 仍应以当前版本执行既有程序要求。已有图像足以判断本报告的美术问题，不因未另跑诊断而推断画布存在错误。

## 当前图片绑定

以下 ID/SHA256 来自 review-r112/manifest.json，并已逐文件核验；region/scale 见该 manifest。
- body/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-47`；SHA256 `79a89e337cb08d4a6528528d6f4538f1e18aea811197ee02a38fe785b9b08a76`；region [129, 79, 308, 755]；scale 1
- body/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-152`；SHA256 `fa5205db41f4bf4e8f2c1da65204297a7f49c17a55cb20c2488ec9da39d2c8d6`；region [129, 79, 308, 755]；scale 1
- full/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-2`；SHA256 `ba939e63e88cbbb8c1e2c240332812c3c1ab8d984f29f24717d63dda76d51258`；region [0, 0, 600, 849]；scale 1
- full/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-153`；SHA256 `46eecb4bfe7cb47760c1a70942f035229a21ec2359c0153d4fe6cf3d8e0a653d`；region [0, 0, 600, 849]；scale 1
- mirror/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-73`；SHA256 `f0ca3038db46e636df450c0d9173dd2fbcc28de1bd0c67baa17c63bd94a8cb61`；region [0, 0, 600, 849]；scale 1
- mirror/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-155`；SHA256 `422dac12e64580758e4922ef31be22b5e88755260579f8d37579e3b1235b3b74`；region [0, 0, 600, 849]；scale 1
- costume/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-9`；SHA256 `9defdef252f80cb0307320b653fd7479236cf7e981d81b394d25b7e370e985b6`；region [93, 231, 495, 438]；scale 1.5
- costume/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-157`；SHA256 `aa6d82835d5d99e537ffc1b4d30cdd7a8358aaec4da17c40ca15464db03f86c6`；region [93, 231, 495, 438]；scale 1.5
- face/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-98`；SHA256 `65be2e34e8a4efde244f3010de86802ab9818a5edd6d972ca9183a10e7add109`；region [267, 176, 141, 113]；scale 3
- face/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-158`；SHA256 `eb7c32768f9745eac242816551b30d5171a30dcb18854275f5e6a66605990373`；region [267, 176, 141, 113]；scale 3
- shoe/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-104`；SHA256 `af3270915525d3ca71e2eb57d4625a20e5515df90d3cba0cb53159c82112f7a1`；region [133, 707, 91, 127]；scale 3
- shoe/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-103`；SHA256 `e3c37a0c5e23d8fa0a9babc6be5e55cf7a5b09516b1bf3f1b1eca8d01742f51c`；region [133, 707, 91, 127]；scale 3
- wrist/reference: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-106`；SHA256 `5ba3873f059f20b9002cf33b6a030a8cff17004676b8291ff4086d3efe53f671`；region [363, 606, 72, 68]；scale 3
- wrist/drawing: ID `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-159`；SHA256 `98db44ac5d29e1c64573750cde3a867e4908e91a8553edf3609bd3cc1542f30c`；region [363, 606, 72, 68]；scale 3
