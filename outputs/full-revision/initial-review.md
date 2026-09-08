# 1F 第二轮清线审核：初审

- 审核者运行 ID：/root/lineart_initial_review（宿主任务路径，不是平台签名）
- 画布 revision：104
- 结论：**needs-work**
- 范围：只读独立审查；先看 full-reference/full-drawing，继而镜像与 local-0、1、2、3、5、6、7。未读主 agent 通过叙述，未修改画布。
- 标准：已完整读取 docs/WORKFLOW_PRINCIPLES.md、docs/workflow-stages/lineart_review.md、docs/workflow-actions/agent-review.md。

## 主要阻断

### M1 服装有效结构被过度概括，几个大部位共同呈纸片化

severity: major；confidence: 0.90。区域：腰裙 x190–365/y411–581，画面左侧搭垂衣袖 x101–276/y379–475，右后大衣摆 x429–582/y506–661。依据 full、mirror 与 local-6 对照。

参考事实：腰部细褶从束腰处出发，经大腿上方展开，裙边有层叠、折返；左侧搭垂袖有向下坠落后再折回的布料体积，外缘转折伴随对应内褶；右后衣摆有由被身体压住处展开的折叠层，外缘并非一个平面扇形。这里所需的是褶脊、谷线的终止、翻折和相互遮挡，不是复制阴影色块。

当前事实：束腰只剩几枚短小三角，裙面接成若干大直线角块，腰部至裙边的褶皱受力连续性不足；左侧搭垂袖几乎是平顶多边形内加两段孤立曲线；右后衣摆由大折线轮廓加几条近乎平行的长横线组成，横线缺少明确的翻折归属和遮挡起止。三个宽大衣物区域共同只剩外壳与抽象分割，无法从线条充分读出参考中的布料厚薄与折叠。

整图影响：服装覆盖角色中下部的主要视觉面积；大袖、裙与衣摆一起平面化，当前整图更像结构概括稿，虽物体可辨认，却缺少达到正式清线完成度的内部结构。不是以 minor 数量升级，也不是因未上色或线少而判错。

建议：回局部细化，先解决腰裙的束腰→压腿→裙边的少数主要褶脊/谷线与遮挡，再重画左搭垂袖的折返和右衣摆的层叠。应逐条说明线是折脊、谷线或被遮边，避免为增密添加任意三角。修改前后都对照参考，并验证袖/裙交界及腿轮廓未受损。

## 不阻断的观察

### m1 抬手指节概括偏机械

severity: minor；confidence: 0.88。x281–336/y243–283，local-0 与 full。
参考手指长度与弯曲各异，有指根聚拢和前后重叠；当前几根手指近似平行带状弧，指尖弯折和指根连接较弱。但手放在脸前、从袖口伸出的关系仍可读，不单独作为 major。建议区分两三根可见指尖的转折与被遮结束，不需要逐关节加线。

### m2 线重层次较弱

severity: minor；confidence: 0.91。全图，特别衣摆内线与外轮廓。
主轮廓、内褶与细小结构大多同样细匀，重叠接缝未形成稳定的强调层次。未见大范围重复试探线或草线残留；单根曲线总体干净。建议仅在遮挡与受力交界加强，内部提示收轻；不要整体描粗。

### m3 小接头间隙

severity: minor；confidence: 0.85。下颌末端约[373,226]到面侧发束约[377,226]。
图像中下颌接近发束处轻微断开，diagnostics 的 gap 约2.2px支持此事实；仍能辨认脸在发束后，不构成主要漏边。建议使下颌在真实遮挡点收住，避免机械延长穿入头发。开放发丝与褶线候选不能一并封口。

### u1 下垂手的掌指细节

severity: uncertain；confidence: 0.68。x377–402/y628–661，local-2。
参考本来只露出很小一块手指/腕部，当前几根细线汇聚到袜口附近椭圆。袖口前缘在约y629挡住腕根，手部从其下缘露出，没看到明确反向穿线，但当前掌指体积很难读。受参考尺寸与遮挡限制，不据此判 major。建议提高该区域观察尺度后确认各线属于哪根指、何处压住袜边，避免凭猜形新增手掌。

## 关键交界与正面证据

- 鞋脚（local-1）：腿轮廓向鞋内结束，前方鞋舌上缘与后跟侧片可区分；鞋头圆弧、鞋底厚度及两条绑带都有独立边界。前掌至足背成立；后跟侧片偏尖、鞋口截面概括，但不足以明确判连接错误。
- 领口（local-3）：颈下界进入领口，前侧领面斜边与领结分离；领结在胸前结点汇合，长发覆盖颈侧、没有领边穿发的明确现象。颈圈两条弧及领边有层次；细节比参考简略，主归属仍清楚。
- 袖口（local-2）：双线袖口提供边缘厚度，腕/指从前缘下方露出，不能因图形封闭就声称掌指充分完成（见 u1）。
- 足背袜口及膝部（local-7/full）：交叉腿前后关系明确，弯曲腿的轮廓压住另一腿，袜破口边界存在。
- 整体/镜像：头、发、裙、两腿的主要布局仍对应参考；头发外轮廓、领结、鞋的主物体可辨；未发现大量重复杂线。以上优点不能抵消 M1 对服装完成度的共同影响。

## 辅助诊断

读取同目录 diagnostics.json。三个指定分隔（鞋踝→鞋舌、袖边→露手、颈前→领面）按物体应分开，结果均 connected=false，与目视主边界相容；它们只证明种子点墨迹分隔，不证明截面、受力或手指结构。没有把 gap 扫描的候选数当作错误数。腕外缘小缝不足以独立阻断。

## 图片绑定

以下为本次实际查看材料的 manifest ID、SHA256；文件哈希另经 Get-FileHash 核验。完整 region/scale 见 review-r104/manifest.json。
- full / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-118`；SHA256 `f1fb8dd6aee933355f88608a97b9a23b8b71ffef27da4e08b777269250811c8e`
- full / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-2`；SHA256 `ba939e63e88cbbb8c1e2c240332812c3c1ab8d984f29f24717d63dda76d51258`
- mirror / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-120`；SHA256 `557ae92f23a2a911c260e90ad0732f98f866b2cc32e77c91efe5994bfd45cc54`
- mirror / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-73`；SHA256 `f0ca3038db46e636df450c0d9173dd2fbcc28de1bd0c67baa17c63bd94a8cb61`
- local-0 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-122`；SHA256 `15de7100ed57970dc5e6ef416834556578458cd279fc258000a8d4e91e339797`
- local-0 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-130`；SHA256 `6aeeffb07487ec5351eaff3c051b0444282cfcb64b8e2a65c8360b90e9c99985`
- local-1 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-123`；SHA256 `bec4375095798bcb6132f6ea9713ef920b4fbd0d7a20e3c78e3b433a329e8b32`
- local-1 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-131`；SHA256 `e11d4731a93a240f7cc12ac64a4a5c5625647ee96cbcb39edce274b6bad1ec79`
- local-2 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-124`；SHA256 `7303892ea0d7baaef12200264c95c82a651cd2460a64474c467f2e2e2f792042`
- local-2 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-132`；SHA256 `e87193308fe98372d4e7c1ff084b6219e1f29eb76c7cb79c2a52f6e46d249065`
- local-3 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-125`；SHA256 `91891a58a3964a5a5d3e6fcffbda767a828f1b3b184f138a55891fd5fc49a9a9`
- local-3 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-133`；SHA256 `3bc72601bc056af0e269fbcf600abcfc5d508912a8ef8bd5062d01428be3ecc2`
- local-5 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-127`；SHA256 `c4f106aecf6d59739b610b7f01d39918e19dbb1867851623467db481cf65a2ef`
- local-5 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-135`；SHA256 `a353b1d15a0ea258f34496d6e337efcb2ef544240d269eff1bc766ebffe9506c`
- local-6 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-128`；SHA256 `8a456780f350b7c56a391237a116e6ff4a6d70dc3cfc78d4bbf5162cabd9b79b`
- local-6 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-136`；SHA256 `c20261fa09b6f15436d6cbc208819e40b186f17bd7dfd2cbe089eed5917a6b77`
- local-7 / drawing: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-129`；SHA256 `40e06b175d83688c2ed5405d791f4b0940dc3c6be8782fc6a28e0d8c9f9af767`
- local-7 / reference: `fe8b29de-1ad7-4a0a-a742-f7c8648c40f6-image-137`；SHA256 `ed1af3feebeed9faa3ade579a277c8aa2231c0dc1c8f188981e52c6326b0fdca`
