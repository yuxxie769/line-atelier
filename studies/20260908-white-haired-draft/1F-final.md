# 1F 第二轮清线独立最终复核

- stage: 1F / lineart_review；round: 2；review: final。
- 审核者运行 ID：/root/lineart_final（宿主任务路径，不声称平台签名）。
- 画布 revision 76；198 条命令（调度提供）；600×849。
- 结论：**pass**；明确 major 0；材料充分。minor 保留，不阻断。
- 本次仅观察和保存报告，没有修改画布、推进阶段。
- 已加载 AGENTS.md、docs/WORKFLOW_PRINCIPLES.md、docs/workflow-stages/lineart_review.md、docs/workflow-actions/agent-review.md。
- 顺序：先读规范与 manifest，再独立看参考/当前整图及镜像，形成“主要物体可读、未见整图级 major”的判断并向主 agent 发出消息；随后查看全部八组参考/画布局部；之后才读初审原文、修改记录与诊断。没有用初审结论代替独立判断。

## 独立观察

1. **全身与镜像：边界、轻重、杂线。** 参考中发、领、袖、裙、腿、鞋互相叠放，衣褶依靠明暗呈现体积。画布中各主轮廓能在全身尺度区分，未见贯穿前景物体的长错误线或重复试探轮廓。内部褶线接近外轮廓线重，右下衣摆 (478–568,520–610) 折返偏尖，整体显得概括、硬朗。severity minor，confidence 0.94；可选减轻内褶并柔化少数折返，不影响当前边界归属。

2. **鞋踝 (153–215,728–786)，local 0。** 参考的腿进入升起的后帮与前方鞋舌之间，鞋头前掌圆，鞋底沿侧面回转。画布腿左缘结束在圆拱鞋舌上，右缘落入鞋帮内侧；鞋舌在前，后帮升起，鞋带附着鞋面，底线沿前掌回折，没有腿线穿过鞋面。鞋口内侧 V 形较参考深尖，鞋跟较硬。severity minor，confidence 0.87；整图仍明确是脚穿鞋，非关节脱节。可选圆缓 V 转角，不机械加封闭环。

3. **下垂袖腕 (366–433,612–667)，local 1。** 参考宽袖口前缘遮住腕部，细长指端牵住袜踝开口。画布双弧边表达袖口厚度，腕/指从下弧后方露出，指线到袜口圆形边附近结束，没有在袖面继续。severity none，confidence 0.89。手形高度简化，但主遮挡、附着点和两种物体边界仍可辨。

4. **颈领与领结 (298–444,239–339)，locals 2、6。** 参考颈圈横向绕颈，胸颈在衣领上缘以上，右前发压住领缘，领结系在前端。画布颈圈双线与下方胸颈边界分开，胸颈区域在衣领弧线上终止；发束覆盖右侧交界而非领线穿过发束；领结连接两侧领面与飘带，肩侧领面与下面衣身有边缘区分。severity none，confidence 0.90。通过依据是可见起止和前后顺序，非单纯封闭。

5. **丝袜破口与腿缘，local 7及人体整局部。** 参考斜腿长破口顺腿方向，踝部小口受手指牵拉；画布长椭圆破口与袜面可分，踝口留在指端下方。零星小破洞简化。severity minor，confidence 0.88；不破坏主要皮肤/袜面边界，无需为清线目标补齐微小碎片。

6. **头发与衣物交界，locals 4、5及全图。** 参考左侧长发多层叠置，右侧细发束沿袖面下垂。画布保留整体流向及右发尾与袖面的分隔，左侧低位飘发汇聚处较简略，细线相邻但尚不足以认定关键前后倒置。severity uncertain，confidence 0.63（仅左侧细束汇聚）；保留，不因扫描开放端点而补成封闭带。全身观看没有足够证据支持 major。

## 诊断辅助

已读取并提取 diagnostics.json 的全部扫描候选：revision76，checked168，connected87，gap61，dangling20，short-stroke0。发丝、鼻口、眼褶、衣褶的开放端点有语义依据；未从这些候选确认主要可见边界的无依据断口。诊断不自行证明清线质量。

三处局部在读结果前已由图像判定应分开：脚踝与鞋面、腕与袖口、颈与领面。现存阈值24的泄漏结果均 enclosed、reachesBorder:false、target connected:false：

- 脚踝 (173,731) → 鞋面 (174,775)。与前鞋舌遮住腿缘、侧后帮包围踝部的目视关系吻合。
- 腕部 (390,637) → 袖口 (390,617)。与袖口前缘盖在腕前的目视关系吻合。
- 颈部 (345,269) → 领面 (336,301)。与胸颈止于衣领上弧的目视关系吻合。

这些只验证采样区域墨迹连通性，未替代本报告的截面、起止、厚度和整图判断。

## 初审事项复核与退步

独立观察后读取 1F-initial.md 与 1F-changes.md。初审后未改画面，仍是 revision76，不能写成“修改后已解决”。初审鞋口尖角、衣褶硬且线重均匀、零碎袜破口简化三项 minor 原样保留，均与本次观察一致；左侧飘发细节 uncertain 保留。袖腕和颈领的无阻断判断独立复核成立。修改记录所述初审前脸颊起点、右发尾断口、鞋面重叠线处理，本次只确认当前对应处未见需阻断的悬空/误接/重复，不声称观察过旧版本修订过程。

新增 major：0。新增退步：未观察到；同一版图像没有初审后几何改动。最终 pass 仅针对第二轮清线阶段容差，不代表逐像素一致或所有细节均已精修。可由主 agent 按已有流程提交当前观察凭据与 lineart-checkpoint，不需第三位审核者。

## 图像绑定

以下为全部实际查看图片的 ID / SHA256（源自 manifest.json）。本审核逐文件重新计算 SHA256，20 张均匹配；ID是所提供图片绑定信息，不是身份认证。图像目录：1F-initial-materials。
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

