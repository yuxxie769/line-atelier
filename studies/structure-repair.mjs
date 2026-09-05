// Model-authored spatial study. No image input, sampling, tracing or contour extraction.
// Coordinates are observation choices; the app only interpolates the chosen through-points.
export function anatomyStudy(){
  const commands=[];
  const line=(id,pts,width=1,closed=false,corners=[],color='#547f96')=>commands.push({id:'construction-'+id,type:'stroke',layer:'anatomy-guide',stage:'lineart',objectId:'anatomy',subphase:'rough',through:pts,width,color,opacity:1,tension:.78,closed,corners,intent:'衣下人体：'+id});
  line('gesture',[[270,207],[274,312],[271,363],[266,428],[261,489],[268,563],[277,629]],.8,false,[],'#be8492');
  line('cranium',[[207,204],[237,177],[277,173],[310,186],[331,215],[335,254],[321,284],[293,299],[251,296],[221,278],[205,246]],1,true);
  line('jaw-plane',[[210,258],[219,292],[242,312],[271,324],[297,314],[321,292],[334,265]],1);
  line('face-center',[[263,176],[271,223],[274,266],[273,297],[271,324]],.6);
  line('eye-cross',[[205,249],[238,257],[276,260],[310,253],[335,243]],.65);
  line('neck-left',[[251,316],[250,334],[242,345]],1);
  line('neck-right',[[297,313],[296,333],[309,350]],1);
  line('neck-section',[[250,333],[269,338],[296,333]],.6);
  line('clavicle-left',[[270,351],[253,348],[237,349],[217,353],[207,358]],1.05);
  line('clavicle-right',[[270,351],[288,348],[305,349],[329,352],[348,360]],1.05);
  line('neck-tendon-left',[[251,322],[258,339],[270,351]],.6);
  line('neck-tendon-right',[[297,319],[283,341],[270,351]],.6);
  line('rib-shell',[[238,354],[267,350],[299,356],[321,376],[329,401],[322,430],[306,449],[283,442],[270,430],[254,445],[235,440],[218,422],[214,396],[221,371]],1.15,true);
  line('sternum',[[270,351],[271,382],[270,409],[270,430]],.85);
  line('rib-cross',[[215,397],[242,407],[271,410],[300,408],[329,398]],.65);
  line('rib-side-plane',[[313,368],[304,391],[306,423],[306,449]],.6);
  line('shoulder-left',[[207,352],[220,357],[224,373],[212,387],[199,380],[196,366]],1,true);
  line('shoulder-right',[[342,352],[355,358],[361,373],[351,389],[336,379],[332,366]],1,true);
  line('waist-left',[[218,420],[214,452],[211,472],[215,488]],1.1);
  line('waist-right',[[325,425],[326,455],[323,479],[316,493]],1.1);
  line('abdominal-axis',[[269,430],[263,478],[266,523],[268,563]],.65);
  line('pelvis-upper-plane',[[216,490],[248,482],[282,485],[312,496],[326,517],[297,526],[262,527],[227,520],[202,510]],1,true);
  line('pelvis-bowl',[[202,510],[191,545],[194,578],[218,607],[247,628],[268,637],[296,625],[327,599],[338,565],[335,539],[326,517]],1.2);
  line('pelvis-front',[[227,520],[235,553],[263,589],[289,558],[297,526]],.8);
  line('pelvis-side-left',[[202,510],[207,540],[199,570],[218,607]],.65);
  line('pelvis-side-right',[[326,517],[318,547],[330,580],[327,599]],.65);
  line('hip-socket-left',[[200,551],[216,543],[234,552],[241,571],[234,592],[217,600],[200,583]],.85,true);
  line('hip-socket-right',[[296,549],[315,547],[329,560],[332,583],[316,598],[299,589],[290,569]],.85,true);
  line('upperarm-left',[[198,366],[178,386],[152,415],[139,430],[145,442],[159,440],[179,417],[212,387]],1.1);
  line('elbow-left',[[140,427],[149,421],[159,428],[160,437],[151,446],[141,440]],.9,true,[2,4]);
  line('forearm-left',[[143,432],[152,405],[171,375],[182,347],[196,350],[188,383],[170,415],[159,438]],1.05);
  line('forearm-cross',[[162,387],[176,391],[185,397]],.6);
  line('wrist-left',[[182,347],[190,344],[198,349],[197,359],[184,358]],.8,true,[0,2,3,4]);
  line('palm-left',[[182,347],[180,335],[186,318],[201,313],[211,322],[206,344],[197,353]],.95,true,[2,3]);
  line('index-gesture',[[187,322],[204,300],[213,287]],.7);
  line('upperarm-right',[[336,378],[335,411],[339,441],[353,448],[364,439],[365,405],[360,374]],1.05);
  line('elbow-right',[[338,437],[350,434],[363,440],[362,452],[350,458],[341,451]],.85,true);
  line('forearm-right',[[341,451],[341,474],[349,501],[354,516],[369,512],[368,489],[363,464],[362,451]],1.05);
  line('forearm-cross-right',[[344,487],[355,490],[367,486]],.6);
  line('wrist-right',[[353,511],[369,507],[372,525],[357,529]],.8,true,[0,1,2,3]);
  line('palm-right-hidden',[[357,529],[357,544],[363,562],[377,558],[382,543],[372,525]],.85,true,[0,2,3,4]);
  line('left-leg-axis',[[218,573],[226,671],[231,791],[226,904],[234,1042]],.65,false,[],'#be8492');
  line('right-leg-axis',[[313,574],[309,679],[306,808],[315,923],[320,1046]],.65,false,[],'#be8492');
  line('left-thigh',[[197,543],[188,581],[187,643],[193,720],[203,767],[207,793],[227,808],[251,802],[255,788],[254,725],[252,670],[254,632],[263,608]],1.15);
  line('left-thigh-section',[[188,630],[207,639],[231,639],[254,632]],.6);
  line('right-thigh',[[325,540],[338,578],[340,639],[337,700],[332,767],[331,806],[316,825],[298,824],[286,808],[282,747],[279,692],[276,646]],1.15);
  line('right-thigh-section',[[277,645],[297,652],[319,652],[340,639]],.6);
  line('left-knee',[[210,781],[231,784],[250,782],[251,802],[234,816],[215,809]],.85,true,[0,2,3,4]);
  line('right-knee',[[288,797],[305,799],[324,793],[328,809],[312,830],[294,824]],.85,true,[0,2,3,4]);
  line('left-calf',[[207,800],[202,840],[200,883],[204,937],[211,988],[220,1048],[247,1049],[251,974],[254,913],[254,853],[254,795]],1.1);
  line('right-calf',[[285,809],[288,857],[291,905],[295,962],[303,1051],[331,1054],[338,989],[341,933],[341,900],[337,867],[331,808]],1.1);
  line('left-calf-section',[[201,865],[218,873],[237,874],[254,867]],.6);
  line('right-calf-section',[[290,900],[310,907],[329,906],[341,899]],.6);
  line('left-shin',[[241,809],[242,878],[239,962],[237,1042]],.55);
  line('right-shin',[[303,828],[312,900],[319,976],[320,1049]],.55);
  line('left-ankle-joint',[[219,1029],[226,1022],[242,1023],[249,1028],[248,1048],[220,1049]],.8,true,[0,3]);
  line('right-ankle-joint',[[300,1033],[308,1026],[324,1029],[333,1037],[332,1056],[303,1053]],.8,true,[0,3]);
  line('left-heel',[[220,1045],[216,1064],[220,1076],[237,1080],[252,1074],[251,1047]],.9,true);
  line('right-heel',[[302,1050],[297,1066],[300,1079],[318,1083],[335,1076],[332,1052]],.9,true);
  line('left-foot-wedge',[[221,1048],[216,1071],[214,1107],[211,1131],[224,1140],[247,1141],[266,1133],[260,1101],[249,1063],[247,1049]],1,true,[0,3,6,9]);
  line('right-foot-wedge',[[303,1051],[299,1073],[294,1108],[292,1136],[310,1149],[334,1147],[347,1137],[340,1106],[332,1072],[331,1054]],1,true,[0,3,6,9]);
  line('left-instep-section',[[215,1104],[229,1097],[245,1098],[261,1108]],.75);
  line('right-instep-section',[[295,1111],[309,1103],[326,1105],[342,1114]],.75);
  line('left-forefoot',[[211,1129],[224,1124],[245,1123],[265,1129],[267,1142],[257,1150],[236,1152],[218,1145]],.85,true);
  line('right-forefoot',[[292,1134],[306,1126],[326,1128],[345,1134],[345,1146],[329,1158],[308,1158],[296,1148]],.85,true);
  line('ground-left',[[207,1173],[239,1177],[274,1174]],.75,false,[],'#be8492');
  line('ground-right',[[289,1176],[320,1181],[353,1176]],.75,false,[],'#be8492');
  return commands;
}

export function upperRepairs(){
  const replace=[],add=[];
  const fix=(id,through,extra={})=>replace.push({id,through,tension:.8,endpoints:['contact','contact'],...extra});
  const mark=(id,objectId,layer,through,width=1,extra={})=>add.push({id,type:'stroke',objectId,layer,stage:'lineart',subphase:'clean',through,tension:.8,color:'#866876',width,opacity:1,endpoints:['contact','contact'],intent:'结构修正：'+id,...extra});
  // The outer crown is continuous from the tall ear root to the ponytail insertion.
  mark('repair-crown-outer','hair-crown','fine-front-hair',[[335,155,.8],[346,170,.9],[353,187,1],[358,207,.9],[357,230,.65]],1.1,{color:'#9c806b'});
  mark('repair-crown-left-root','hair-crown','fine-front-hair',[[265,137,.8],[277,142,.9],[287,148,.9],[295,154,.7]],.95,{color:'#9c806b'});
  mark('repair-crown-ear-fold','hair-crown','fine-front-hair',[[329,149,.2],[340,169,.8],[347,190,.65]],.55,{color:'#b5997b',endpoints:['open','open']});
  mark('repair-pony-insertion','hair-crown','fine-front-hair',[[358,207,.65],[355,207,.8],[351,213,.9],[351,225,.8],[356,235,.6]],.8,{color:'#9c806b'});
  fix('fine-front-hair-behind-ear',[[340,228,.4],[349,237,.75],[354,249,.9],[349,277,.6]],{width:.85});
  fix('fine-visor-cap-backstrap',[[340,201,.6],[352,210,.9],[357,225,.8],[357,238,.7],[351,228,.75],[341,219,.5]],{closed:true,corners:[3]});
  // Neck -> clavicle -> shoulder top. This boundary was never drawn, not hidden by clothing.
  fix('fine-body-shoulder-left',[[250,336,.8],[245,345,.65],[235,348,.8],[223,347,.85],[216,348,.65]],{objectId:'left-shoulder',width:1.05});
  mark('repair-left-armhole','body','fine-body',[[240,349,.15],[230,353,.7],[223,361,.8],[216,378,.35]],.75,{endpoints:['open','occluded']});
  fix('fine-body-shoulder-right',[[296,336,.7],[305,346,.7],[320,350,.75],[338,353,.85],[353,357,.9],[360,369,1],[364,392,.9],[365,417,.85],[363,439,.85],[365,461,.9]],{objectId:'right-arm',width:1.1});
  fix('fine-body-arm-inner',[[337,377,.15],[341,393,.55],[343,407,.85],[339,422,.35]],{objectId:'right-arm',width:.65,endpoints:['occluded','open']});
  fix('fine-body-arm-lower',[[365,461,.85],[368,477,.9],[373,481,.6]],{objectId:'right-arm',width:1.05});
  mark('repair-right-armhole','body','fine-body',[[334,354,.3],[330,369,.75],[333,390,.65],[337,405,.3]],.75,{endpoints:['occluded','occluded']});
  // Left hanging hair is in FRONT of shoulder, behind the fingers, and enters the cuff.
  fix('fine-front-hair-left-neck-lock',[[218,299,.85],[227,310,.85],[229,324,.85],[228,345,.9],[223,369,.9],[215,393,1]],{objectId:'left-lock',width:1.05});
  mark('repair-left-lock-inner','left-lock','fine-front-hair',[[193,333,.7],[196,352,.75],[203,372,.9],[215,393,1]],1.05,{color:'#9c806b'});
  fix('fine-front-hair-left-neck-inner',[[221,319,.1],[223,341,.45],[219,368,.15]],{objectId:'left-lock',width:.5,endpoints:['open','open']});
  // One cuff: rear rim, front rim, fabric outer edge. No disconnected mouth arc.
  fix('fine-coat-raised-outer',[[177,347,.9],[160,351,.85],[143,366,.85],[124,389,.9],[116,400,1],[102,411,.9],[87,437,1],[81,461,1],[83,479,.95],[92,487,.85],[112,492,1],[134,489,.85],[161,480,.9],[188,467,1],[208,451,.9],[216,445,.8]],{objectId:'raised-sleeve',layer:'fine-raised-sleeve',width:1.2});
  fix('fine-coat-raised-inner',[[211,412,.7],[216,424,.85],[216,437,.85],[216,445,.8]],{objectId:'raised-sleeve',layer:'fine-raised-sleeve',width:1.05});
  fix('fine-coat-raised-cuff-outer',[[177,347,.85],[169,365,.9],[165,384,1],[168,402,.9],[180,411,.85],[196,418,.95],[207,420,.9],[214,403,1],[215,393,.95]],{objectId:'raised-sleeve',layer:'fine-raised-sleeve',width:1.1});
  fix('fine-coat-raised-cuff-mouth',[[177,347,.85],[181,346,.7],[183,352,.8]],{objectId:'raised-sleeve',layer:'fine-raised-sleeve',width:.8});
  fix('fine-coat-raised-cuff-inner',[[183,352,.75],[190,367,.8],[201,382,.9],[210,391,.95],[215,393,1]],{objectId:'raised-sleeve',layer:'fine-raised-sleeve',width:1});
  fix('fine-coat-raised-cuff-seam',[[166,391,.2],[171,405,.65],[187,415,.6],[207,420,.45]],{objectId:'raised-sleeve',layer:'fine-raised-sleeve',width:.55,endpoints:['open','contact']});
  mark('repair-wrist-in-cuff','left-wrist','fine-hand',[[187,351,.8],[184,348,.8],[181,341,.7]],.85,{endpoints:['contact','contact']});
  // Side of bodysuit stops at the actual sleeve overlap, resumes at the lower hair overlap.
  fix('fine-body-side-left-upper',[[216,437,.4],[219,446,.85],[216,454,.8],[207,465,.75]],{width:.95,endpoints:['occluded','occluded']});
  fix('fine-body-side-left-waist',[[208,481,.8],[200,497,.85],[197,516,.85],[197,533,.8]],{width:1.05,endpoints:['occluded','contact']});
  fix('fine-body-side-right-waist',[[330,439,.6],[327,462,.8],[326,486,.8],[328,511,.8],[331,532,.85]],{width:1});
  // Folded right sleeve wraps around the lowered forearm; every rim has a return edge.
  fix('fine-coat-right-opening',[[330,489,.9],[342,482,.85],[353,487,.9],[371,473,.9],[379,470,1],[386,482,.9],[388,488,.85]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:1.15,corners:[2,4]});
  fix('fine-coat-right-cuff-top',[[330,489,.9],[349,489,.85],[371,486,.9],[388,488,1],[391,499,.9]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:1});
  fix('fine-coat-right-fold-loop',[[352,488,.85],[359,492,.9],[363,498,.8],[359,506,.85],[348,513,.55]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:.85,endpoints:['contact','open']});
  fix('fine-coat-right-cuff-front',[[332,525,.9],[349,517,.9],[369,512,.95],[388,513,.95],[395,520,1],[395,528,.9],[390,532,.7]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:1.15});
  mark('repair-roll-return','hanging-sleeve','fine-hanging-sleeve',[[391,499,.9],[394,506,.9],[388,513,.85]],1.05);
  fix('fine-coat-right-upper-roll',[[339,539,.85],[350,531,.9],[371,528,.9],[391,530,.9],[398,536,1]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:1.1});
  fix('fine-coat-hanging-sleeve-outer',[[398,536,1],[405,549,.8],[416,567,.9],[431,596,.9],[447,630,1],[452,646,.9],[466,655,1],[469,665,.9],[468,675,1]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:1.2});
  fix('fine-coat-hanging-sleeve-inner',[[339,539,.85],[337,568,.85],[339,610,.9],[339,650,.9],[344,672,1],[365,685,.9],[397,704,.9]],{objectId:'hanging-sleeve',layer:'fine-hanging-sleeve',width:1.1});
  mark('repair-roll-underlip','hanging-sleeve','fine-hanging-sleeve',[[395,528,.8],[381,524,.85],[359,528,.7],[341,538,.55]],.7,{endpoints:['contact','open']});
  // Hair curl outer silhouette must return behind the jacket, not end in open space.
  mark('repair-left-curl-return','front-hair','fine-front-hair',[[181,531,.8],[175,518,.85],[167,496,.9],[169,480,.9],[190,463,.85],[208,451,.8]],1,{color:'#9c806b'});
  fix('fine-front-hair-low-left-curl',[[216,445,.8],[211,453,.95],[201,465,.85],[185,477,.9],[176,486,.9],[185,495,.95],[206,498,1],[195,507,.8],[188,518,.9],[191,529,.8],[205,533,1],[194,541,.9],[181,531,.8]],{width:1.05,corners:[6,10]});
  fix('fine-coat-left-ribbed-hem',[[85,585,.85],[84,599,.9],[109,615,.9],[141,628,.85],[184,638,.9],[184,635,.85]],{width:1.05});
  return {replace,add};
}

export function repairSceneData(scene){
  const s=structuredClone(scene);delete s.issues;
  const obj=(id,name,frame,parent='figure',note='')=>s.objects.push({id,name,frame,parent,phase:'structure_review',material:'opaque',note});
  obj('hair-crown','耳根与冠发',[260,130,102,125],'front-hair','从耳根沿头壳接到马尾根，不留无主缺口');
  obj('left-lock','手后垂发',[177,294,54,102],'front-hair','发束在手后、肩前，发尖进入袖口；不是裸露前臂');
  obj('left-shoulder','左侧颈肩皮肤',[213,334,45,46],'figure','颈根经锁骨接肩；前面有垂发');
  obj('right-arm','右肩与裸露上臂',[295,335,81,155],'figure','从颈根经过肩峰、上臂、肘部进入卷袖');
  obj('left-wrist','进入抬起袖口的手腕',[179,329,22,31],'hand','腕部在手掌下、袖口内，不以发束代替手腕');
  obj('raised-sleeve','抬起的衣袖与袖口',[79,343,145,150],'coat','袖体绕屈肘形成大体积，袖口在腕部收束');
  obj('hanging-sleeve','下垂衣袖与翻折口',[325,469,170,271],'coat','翻折口包住上臂下段，外沿与下垂袖体相连');
  obj('left-foot','左脚：脚踝、脚背、脚趾',[209,1021,59,132],'figure','皮肤实体；鞋帮与绑带覆盖脚背，脚趾在露趾口内');
  obj('right-foot','右脚：脚踝、脚背、脚趾',[292,1026,57,132],'figure','独立脚体积，不是鞋上画的装饰线');
  obj('left-shoe-upper','左鞋：筒口、鞋帮、绑带',[203,1028,74,132],'shoes','鞋口后沿在腿后，前沿在腿前；皮肤不能终止于后沿');
  obj('right-shoe-upper','右鞋：筒口、鞋帮、绑带',[288,1032,69,135],'shoes','鞋筒口具有厚度与内外沿；脚背在鞋帮内');
  obj('left-sole','左鞋底与足床',[205,1102,72,75],'shoes','足床承托脚掌；与鞋帮、皮肤分开');
  obj('right-sole','右鞋底与足床',[286,1107,72,75],'shoes','鞋底位于脚掌之下，与地面接触');
  s.objects.find(o=>o.id==='figure').note='结构修订中：先看体积与连接，再复核清线；撤回上一轮全身通过判断';
  s.objects.find(o=>o.id==='figure').phase='structure_review';
  const region=(id,objectId,through,purpose,corners=[])=>s.regions.push({id,objectId,through,corners,purpose});
  const cover=(regionId,back)=>s.occlusions.push({id:regionId+'-over-'+back,regionId,back,note:'模型定义前后物体；几何不来自图像提取'});
  region('crown-shell','hair-crown',[[265,137],[295,149],[329,190],[340,251],[355,250],[357,230],[358,207],[353,187],[335,155]],'耳根和冠发遮住帽后装饰');cover('crown-shell','halo');
  region('left-lock-shell','left-lock',[[218,299],[227,310],[229,324],[228,345],[223,369],[215,393],[203,372],[196,352],[191,332],[195,310]],'手后垂发遮住肩和领侧');
  cover('left-lock-shell','body');cover('left-lock-shell','left-shoulder');
  region('palm-front-shell','hand',[[213,286],[216,289],[208,304],[214,320],[211,336],[203,347],[191,353],[183,350],[179,340],[183,325],[190,313],[202,299]],'手掌和食指在垂发前');cover('palm-front-shell','left-lock');
  cover('front-lock-volume','right-arm');
  return s;
}

export function repairLayers(layers){
  const ls=structuredClone(layers),newLayer=(id,name,group)=>({id,name,group,role:'ink',visible:true,opacity:1,blend:'source-over',locked:false});
  ls.splice(ls.findIndex(l=>l.id==='fine-shoes'),0,
    newLayer('fine-left-foot','脚踝与脚趾 · 左','足部皮肤'),newLayer('fine-right-foot','脚踝与脚趾 · 右','足部皮肤'),
    newLayer('fine-left-sole','左鞋底与足床','鞋底'),newLayer('fine-right-sole','右鞋底与足床','鞋底'));
  ls.splice(ls.findIndex(l=>l.id==='fine-coat')+1,0,newLayer('fine-raised-sleeve','抬起的袖体与袖口','衣袖'),newLayer('fine-hanging-sleeve','下垂袖体与翻折口','衣袖'));
  return ls;
}

export function feetRepairs(){
  const replace=[],add=[],remove=[],regions=[],occlusions=[];
  const fix=(id,through,extra={})=>replace.push({id,through,tension:.82,endpoints:['contact','contact'],...extra});
  const mark=(id,objectId,layer,through,width=.85,extra={})=>add.push({id,type:'stroke',objectId,layer,stage:'lineart',subphase:'clean',through,tension:.8,color:'#896e78',width,opacity:1,endpoints:['contact','contact'],intent:'足鞋分体：'+id,...extra});
  // The calf continues PAST the rear rim. Its lower end meets the front rim.
  fix('fine-left-leg-calf-outer',[[207,800,.75],[202.5,839,.9],[200.5,883,1],[203.5,932,.85],[210,982,.85],{anchor:'left-ankle-outer'},[219.5,1045,.9],[220,1052,.85]],{width:1.05});
  fix('fine-left-leg-calf-inner',[[254,795,.8],[253.5,840,.8],[254,888,.9],[252,942,.8],[250,990,.8],{anchor:'left-ankle-inner'},[247.5,1053,.85]],{width:1.05});
  fix('fine-right-leg-calf-inner',[[284.5,800,.8],[287,832,.8],[289,879,.85],[292,929,.9],[296,982,.8],{anchor:'right-ankle-inner'},[303,1056,.85]],{width:1.05});
  fix('fine-right-leg-calf-outer',[[331,808,.75],[332.5,837,.85],[339,878,.9],[341.5,914,1],[340.5,948,.9],[337,993,.8],{anchor:'right-ankle-outer'},[331,1058,.85]],{width:1.05});
  for(const side of ['left','right']){
    const left=side==='left',p='fine-shoes-'+side+'-',obj=side+'-shoe-upper',foot=side+'-foot',sole=side+'-sole';
    // Each side is observed independently; the two shoes are not mirrored duplicates.
    const f=(id,pts,extra={})=>fix(p+id,pts,{objectId:obj,layer:'fine-shoes',width:1.05,...extra});
    if(left){
      f('cuff-back',[[207,1038,.8],[208,1034,.85],[212,1032,.8],{anchor:'left-ankle-outer'}],{width:.8});
      f('cuff-back-right',[{anchor:'left-ankle-inner'},[256,1035,.8],[262,1038,.8],[264,1040,.75]],{width:.8});
      f('cuff-front',[[207,1038,.8],[207,1047,.9],[220,1052,1],[238,1054,.95],[247.5,1053,.95],[261,1049,.9],[264,1040,.85]],{width:1.1});
      mark('repair-left-cuff-thickness',obj,'fine-shoes',[[207,1047,.85],[207,1052,.8],[220,1058,.85],[239,1060,.9],[257,1057,.9],[264,1050,.85],[264,1040,.8]],.7);
      f('upper-outer',[[207,1052,.8],[205.5,1063,1],[208,1077,.85],[212,1086,.8],[211,1092,.85]]);
      f('upper-inner',[[264,1050,.8],[267,1064,1],[265,1077,.9],[262,1089,.85]]);
      f('tongue-left',[[210,1056,.1],[218,1066,.7],[225,1073,.8],[227,1083,.8]],{width:.75,endpoints:['open','contact']});
      f('tongue-right',[[262,1054,.1],[254,1066,.7],[250,1076,.8],[249,1083,.8]],{width:.75,endpoints:['open','contact']});
      f('outer-gather',[[207,1071,.1],[213,1079,.65],[216,1088,.6]],{width:.55,endpoints:['open','occluded']});
      f('inner-gather',[[266,1072,.1],[259,1081,.65],[261,1089,.6]],{width:.55,endpoints:['open','occluded']});
      f('toe-opening',[[209,1137,.9],[214,1126,1],[231,1123,.9],[249,1125,.95],[265,1131,1],[271,1140,.9]]);
      // Foot contour includes a connected forefoot and five overlapping toe tips.
      f('toe1',[[214,1127,.8],[215,1135,.85],[218,1142,.95],[223,1145,.95],[227,1143,.85],[231,1149,1],[237,1150,.95],[241,1147,.9],[245,1151,1],[250,1151,.9],[254,1148,.85],[260,1149,1],[266,1145,.95],[267,1137,.9],[265,1131,.8]],{objectId:foot,layer:'fine-left-foot',width:.9,corners:[4,7,10]});
      mark('repair-left-toe2-seam',foot,'fine-left-foot',[[227,1143,.85],[226,1138,.7],[224,1133,.1]],.6,{endpoints:['contact','open']});
      mark('repair-left-toe3-seam',foot,'fine-left-foot',[[241,1147,.8],[239,1139,.7],[237,1133,.1]],.6,{endpoints:['contact','open']});
      mark('repair-left-toe4-seam',foot,'fine-left-foot',[[254,1148,.85],[252,1140,.8],[251,1132,.1]],.65,{endpoints:['contact','open']});
      mark('repair-left-toe-small-seam',foot,'fine-left-foot',[[219,1142,.8],[219,1137,.6]],.45,{endpoints:['contact','open']});
      // Side panels connect the separated straps into a shoe upper.
      mark('repair-left-side-bridge-1',obj,'fine-shoes',[[209,1104,.85],[209,1107,.8],[210,1109,.85]],.85);
      mark('repair-left-side-bridge-2',obj,'fine-shoes',[[269,1108,.85],[269,1113,.85]],.85);
      mark('repair-left-vamp-left',obj,'fine-shoes',[[214,1089,.8],[209,1110,.8],[208,1124,.9],[209,1137,.9],[210,1147,.85]],.9);
      mark('repair-left-vamp-right',obj,'fine-shoes',[[261,1089,.85],[269,1113,.9],[272,1130,1],[273,1151,.9]],.9);
      mark('repair-left-vamp-seam-left',obj,'fine-shoes',[[220,1116,.8],[216,1126,.85],[211,1134,.7]],.7);
      mark('repair-left-vamp-seam-right',obj,'fine-shoes',[[257,1117,.8],[262,1127,.85],[269,1137,.75]],.7);
      f('footbed',[[210,1147,.85],[217,1154,.9],[235,1158,.85],[257,1157,.9],[273,1151,.85]],{objectId:sole,layer:'fine-left-sole',width:.9});
      f('sole-rim',[[208,1159,.85],[220,1164,.8],[242,1166,.9],[262,1163,.85],[273,1158,.85]],{objectId:sole,layer:'fine-left-sole',width:.7});
      mark('repair-left-footbed-inner',sole,'fine-left-sole',[[211,1141,.4],[213,1150,.65],[222,1156,.45]],.5,{endpoints:['occluded','open']});
      f('tab',[[229,1021],[241,1020.5],[241.5,1032],[237,1035],[231,1034]],{closed:true,corners:[0,1],width:.7});
      regions.push({id:'left-front-upper-cover',objectId:obj,through:[[207,1047],[220,1052],[238,1054],[261,1049],[264,1050],[267,1064],[261,1088],[270,1117],[271,1140],[265,1131],[249,1125],[231,1123],[214,1126],[209,1137],[207,1112],[212,1086],[205,1063]],corners:[8,13],purpose:'鞋口前沿至露趾口之间的鞋帮在皮肤前面；开口内保留脚趾'});
    }else{
      f('cuff-back',[[290,1042,.8],[294,1038,.8],{anchor:'right-ankle-inner'}],{width:.8});
      f('cuff-back-right',[{anchor:'right-ankle-outer'},[341,1043,.8],[345,1046,.75]],{width:.8});
      f('cuff-front',[[290,1042,.8],[290,1050,.9],[303,1056,1],[319,1059,.95],[331,1058,1],[344,1053,.9],[345,1046,.8]],{width:1.1});
      mark('repair-right-cuff-thickness',obj,'fine-shoes',[[290,1050,.8],[290,1056,.85],[303,1062,.9],[321,1065,.9],[339,1061,.9],[346,1055,.85],[345,1046,.8]],.7);
      f('upper-outer',[[290,1056,.8],[288,1068,1],[292,1082,.9],[296,1090,.85],[294,1098,.85]]);
      f('upper-inner',[[346,1055,.8],[349,1069,1],[347,1081,.9],[343,1094,.85]]);
      f('tongue-left',[[292,1061,.1],[299,1071,.7],[307,1078,.8],[310,1089,.8]],{width:.75,endpoints:['open','contact']});
      f('tongue-right',[[345,1060,.1],[335,1072,.7],[331,1080,.8],[330,1089,.8]],{width:.75,endpoints:['open','contact']});
      f('outer-gather',[[291,1077,.1],[298,1085,.65],[299,1093,.6]],{width:.55,endpoints:['open','occluded']});
      f('inner-gather',[[347,1079,.1],[341,1087,.6],[342,1093,.6]],{width:.55,endpoints:['open','occluded']});
      f('toe-opening',[[292,1141,.9],[296,1130,1],[311,1126,.95],[331,1129,.9],[347,1136,1],[352,1146,.9]]);
      f('toe1',[[296,1130,.85],[295,1140,.9],[299,1150,1],[305,1155,1],[312,1154,.9],[315,1151,.9],[319,1157,1],[324,1157,.95],[328,1153,.9],[332,1155,.95],[337,1153,.9],[339,1148,.9],[343,1150,.9],[347,1147,.95],[348,1141,.9],[347,1136,.8]],{objectId:foot,layer:'fine-right-foot',width:.9,corners:[5,8,11]});
      mark('repair-right-toe2-seam',foot,'fine-right-foot',[[315,1151,.9],[313,1143,.75],[313,1135,.1]],.7,{endpoints:['contact','open']});
      mark('repair-right-toe3-seam',foot,'fine-right-foot',[[328,1153,.9],[326,1146,.65],[326,1137,.1]],.6,{endpoints:['contact','open']});
      mark('repair-right-toe4-seam',foot,'fine-right-foot',[[339,1148,.9],[337,1142,.7],[337,1137,.1]],.6,{endpoints:['contact','open']});
      mark('repair-right-toe-small-seam',foot,'fine-right-foot',[[344,1149,.7],[344,1143,.4]],.4,{endpoints:['contact','open']});
      mark('repair-right-side-bridge-1',obj,'fine-shoes',[[293,1107,.85],[292,1114,.85]],.85);
      mark('repair-right-side-bridge-2',obj,'fine-shoes',[[349,1115,.85],[349,1119,.85]],.85);
      mark('repair-right-vamp-left',obj,'fine-shoes',[[297,1093,.8],[292,1114,.9],[290,1132,.95],[290,1153,.85]],.9);
      mark('repair-right-vamp-right',obj,'fine-shoes',[[343,1094,.85],[350,1118,.9],[353,1140,.95],[354,1157,.85]],.9);
      mark('repair-right-vamp-seam-left',obj,'fine-shoes',[[303,1121,.8],[298,1131,.85],[293,1140,.7]],.7);
      mark('repair-right-vamp-seam-right',obj,'fine-shoes',[[340,1123,.8],[345,1133,.85],[350,1144,.7]],.7);
      f('footbed',[[290,1153,.85],[299,1161,.9],[318,1165,.9],[339,1163,.9],[354,1157,.85]],{objectId:sole,layer:'fine-right-sole',width:.9});
      f('sole-rim',[[290,1165,.85],[302,1170,.85],[324,1172,.85],[344,1168,.8],[353,1164,.85]],{objectId:sole,layer:'fine-right-sole',width:.7});
      mark('repair-right-footbed-inner',sole,'fine-right-sole',[[292,1148,.4],[295,1157,.7],[302,1162,.4]],.5,{endpoints:['occluded','open']});
      f('tab',[[310,1026],[322,1027],[323,1038],[319,1041],[312,1040]],{closed:true,corners:[0,1],width:.7});
      regions.push({id:'right-front-upper-cover',objectId:obj,through:[[290,1050],[303,1056],[319,1059],[344,1053],[346,1055],[349,1069],[343,1094],[351,1123],[352,1146],[347,1136],[331,1129],[311,1126],[296,1130],[292,1141],[289,1120],[296,1090],[288,1068]],corners:[8,13],purpose:'右鞋帮和前筒口覆盖脚背与脚踝，脚趾属于独立皮肤对象'});
    }
    for(let n=2;n<=5;n++)remove.push(p+'toe'+n);
    for(const suffix of ['nail1','nail2'])replace.push({id:p+suffix,objectId:foot,layer:'fine-'+foot,endpoints:['open','open'],width:.4});
    for(const suffix of ['outer-side','inner-side','sole-bottom'])replace.push({id:p+suffix,objectId:sole,layer:'fine-'+sole,endpoints:['contact','contact']});
    occlusions.push({id:side+'-upper-over-foot',regionId:side+'-front-upper-cover',back:foot,note:'鞋包住脚，露趾处保留皮肤；不把脚趾当鞋纹'});
  }
  return {replace,add,remove,regions,occlusions};
}
