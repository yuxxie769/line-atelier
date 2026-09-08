# 1F 第二轮清线独立初审

- 审核者运行 ID：/root/lineart_initial（宿主任务路径；不是平台签名）
- stage：1F / lineart_review；round：2；review：initial。
- 当前画布：revision 76；198 命令（调度材料）；600×849。
- 结论：**pass**。明确 major：0。材料充分；minor 不阻断。
- 只观察与报告，未修改画布、推进阶段或读取主 agent 的通过结论。
- 已读取 AGENTS.md、docs/WORKFLOW_PRINCIPLES.md、docs/workflow-stages/lineart_review.md、docs/workflow-actions/agent-review.md。
- 观察顺序：参考整图→当前整图→关键交界局部→镜像及衣发局部→诊断→人体局部。全部 8 组局部均查看。整图原尺寸本身已显示在可一眼观察全身的尺度；镜像全身另行对照。

## 逐项观察

1. **鞋口与脚踝，约 (153–215, 728–786)**。参考：小腿进入鞋，前方鞋舌及侧帮包住足背，后跟侧有升起的鞋帮，鞋底在前掌绕回。画布：小腿左轮廓到鞋舌后停止，右侧在鞋帮内侧下转；前方圆拱鞋舌、两道鞋带、外侧鞋帮和鞋底互相可分辨，足背与前掌方向一致。没有把脚踝贯穿鞋面。内侧鞋口 V 转折较参考尖且深，鞋跟也更硬；severity **minor**，confidence 0.86。建议可在后续精修把 (189,758) 附近转折稍圆缓，维持鞋帮围绕脚踝，不需要新增封闭环。整图不因此丢失脚入鞋的关系。

2. **下垂袖口与手，约 (366–433, 612–667)**。参考：宽袖口前缘覆盖腕部，露出的细长手指向下接触袜口。画布：双弧线形成袖口厚度，腕/指线在下缘开始，并汇向袜踝的小开口，未穿过袖面。没有边界误接造成手臂与衣服混区。severity **none**，confidence 0.88；保持。

3. **颈、衣领、相邻发束，约 (298–395, 239–290)，及领结到 (314,330)**。参考：颈圈绕颈，肤色胸颈区域在衣领上方，右侧前发束压住局部边缘，领结附着水手领前端。画布：颈圈双线可辨，颈前轮廓在衣领弧边终止，右前发束穿到衣领前方并以尖端结束；衣领前缘与颈域有独立边界，领结结点连接两片领缘和飘带。当前没有延续到颈部的领口穿线。severity **none**，confidence 0.89；保持。局部6亦支持此观察，未读取其历史结论。

4. **丝袜破口，约 (289–330, 584–630) 及踝处**。参考：斜置小腿有长椭圆形破口，踝边还有受手指牵拉的小开口。画布：小腿长开口两侧轮廓相接，保留狭长形和斜方向；踝口与手指衔接清楚。参考零碎小破口被简化，但不混淆皮肤与袜面的大边界。severity **minor**，confidence 0.85；细碎破口仅可选补充，不是封口任务。

5. **衣褶与线条层次，全身，尤 (478–568, 520–610)**。参考：外套右摆褶皱沿布料体积铺开，有轻重和软硬转换。画布：主体外缘较细，内褶大多同等粗细，右摆三段折线偏规律、尖硬。severity **minor**，confidence 0.93。建议适当减轻内褶、减少连续尖锐折返；当前衣摆、袖子、裙摆仍各有明确外缘，缩小和镜像后未形成物体归属错误。不可把所有开放褶线接到外边。

6. **头发、抬手周边与全身遮挡**。参考：发束从后方展开，胸前辫/手与袖互相遮挡，长发压过肩袖。画布：头发主轮廓、辫段、手指和抬起袖口均可读；左方飘发交汇处较简略，部分发丝端点开放，但没有充分证据表明其是必须封合的主物体缺边。severity **uncertain**，confidence 0.62（仅针对左侧飘发交会细节）；建议保留，不以扫描数量推定错误。未观察到需要以 major 阻断的重复杂线或明显穿线。

## 诊断作为辅助

读取 diagnostics.json。扫描 revision 76，checked 168，connected 87，candidate/inspect 共81（gap61、dangling20），没有 short-stroke。候选包含嘴、鼻、眼褶、发丝和衣褶的合理开放端点；不将其批量升级为缺边。结合整图与局部判断后，未发现有充分视觉证据的主要缺边。

三处跨界均先按物体语义判断应分开；实际预览均 enclosed、reachesBorder false、target connected false：

- 脚踝 (173,731) 与鞋面 (174,775)：分开；与目视鞋舌/鞋帮遮挡吻合。
- 手腕 (390,637) 与袖口 (390,617)：分开；与袖口前缘覆盖手腕吻合。
- 颈 (345,269) 与领 (336,301)：分开；与衣领上弧边分隔胸颈吻合。

上述只证明采样点之间不连通；本报告的判断另外依据局部截面、人体终止位置与整图效果，没有以闭合作美术通过的充分条件。

## 图像绑定

以下为此次实际读取的材料清单，ID/SHA256来自提供的 manifest.json；报告不把ID当作模型理解或身份认证。复核应绑定修后当前图像，不能直接挪用本初审。

[
  {
    "file": "full.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-217",
    "sha256": "0b4e27495eaea3eb50c97dee6f69762f2e4c9881e9a500c8d1456013dd21b705"
  },
  {
    "file": "full.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-5",
    "sha256": "ba939e63e88cbbb8c1e2c240332812c3c1ab8d984f29f24717d63dda76d51258"
  },
  {
    "file": "mirrored.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-220",
    "sha256": "e1f9cc6bd2b0517bbb5955668076324e4c93e4b891c7b2ffd15d27bf432c87db"
  },
  {
    "file": "mirrored.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-14",
    "sha256": "f0ca3038db46e636df450c0d9173dd2fbcc28de1bd0c67baa17c63bd94a8cb61"
  },
  {
    "file": "locals.0.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-221",
    "sha256": "f99fc044e917b611fbdd48d41d97dd18cf0970ec84f249160b2e00d19a430498"
  },
  {
    "file": "locals.1.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-222",
    "sha256": "28c9aab49f50e1308995b4cf569274adc4833d521f30aa519eae0cbd40b93cbf"
  },
  {
    "file": "locals.2.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-223",
    "sha256": "50c9178ab37b055c71207c7f2380ae99d232e43faca8f50e086337d8d6f60bfe"
  },
  {
    "file": "locals.3.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-224",
    "sha256": "4795b4f09e6facdad4d442e7bf8f5b9f1c04da6f224eb94cefe2267167d74780"
  },
  {
    "file": "locals.4.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-225",
    "sha256": "72c15e4bcf05f0653fd1b33347070cbd6ca81a6e1c2bf596b33680543d3696ac"
  },
  {
    "file": "locals.5.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-226",
    "sha256": "c94e79f6bd298d1fd0b7d51c8dfdfd5441de4b4ef7211c996cbbe9de7530dca0"
  },
  {
    "file": "locals.6.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-215",
    "sha256": "30dc4ab61b9b760149befdea5f9199f3fa6547fc0f3a576b80f4c9d83eb54f40"
  },
  {
    "file": "locals.7.drawing.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-216",
    "sha256": "4ec71ffee49ba750568cb75663c2ec1cc9d36bfeea3191444d4c9a0d722da159"
  },
  {
    "file": "locals.0.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-227",
    "sha256": "a4fb46800f98f0a6728b0bccf21076cc445f95539a045cf34bc5cde7abe12312"
  },
  {
    "file": "locals.1.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-228",
    "sha256": "31ed6dee4bdf30c84d37ad07401fe11d162cf0aa8791d42c242120463e19bf5c"
  },
  {
    "file": "locals.2.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-229",
    "sha256": "db9f4e2585d079e4e94a1cd341e0b17d6159d5b9cf6a5ab8aacbac89892c1ae2"
  },
  {
    "file": "locals.3.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-230",
    "sha256": "3f13e172d201e7fce10f80d3ad81af045d2649af7783071aafb921aa2aa0f266"
  },
  {
    "file": "locals.4.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-231",
    "sha256": "5047ec6a81f5719eb99ec93cf77b30bd06287c9c2bbf9e134e839fd2fbaa8da6"
  },
  {
    "file": "locals.5.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-232",
    "sha256": "0c4aa2882e76e99b61928a387fc0f9a121dcc653ba37413cd98484815372f8b9"
  },
  {
    "file": "locals.6.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-52",
    "sha256": "3bc72601bc056af0e269fbcf600abcfc5d508912a8ef8bd5062d01428be3ecc2"
  },
  {
    "file": "locals.7.reference.png",
    "id": "0364457c-6dfc-49bf-b994-9615847b56fe-image-88",
    "sha256": "ed1af3feebeed9faa3ade579a277c8aa2231c0dc1c8f188981e52c6326b0fdca"
  }
]

