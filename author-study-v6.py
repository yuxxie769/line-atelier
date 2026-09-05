"""Model-authored brush manuscript. Geometry from the user-supplied v5 is a scaffold.
No image loading, sampling, segmentation, palette fitting, or residual reconstruction.
This script prepares explicit pen paths for subsequent WebMCP tool calls; it doesn't paint.
"""
import json,copy,sys
from pathlib import Path
source=json.loads(Path(sys.argv[1]).read_text());out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
regions=copy.deepcopy(source['regions']);rmap={r['id']:r for r in regions}
groups=[{'id':l['id'],'name':l['name']} for l in source['layers'] if l['id'] not in ['sketch','lineart','finish']]
layers=[{'id':'sketch','name':'结构草稿','visible':False,'opacity':.35,'blend':'source-over'}]
for g in groups:
 for suffix,name,blend in [('', '底色','source-over'),('-shade','阴影','multiply'),('-light','修色与高光','source-over')]:
  layers.append({'id':g['id']+suffix,'name':g['name'].split(' / ')[0]+' · '+name,'group':g['id'],'visible':True,'opacity':1,'locked':False,'blend':blend,**({'clipTo':g['id']} if suffix else {})})
layers.extend([{'id':'lineart','name':'完整线稿','visible':True,'opacity':.9,'blend':'source-over'},{'id':'finish','name':'最后压线 / 镜面反光','visible':True,'opacity':1,'blend':'source-over'}])
for r in regions:r.update(shadeLayer=r['layer']+'-shade',lightLayer=r['layer']+'-light')
# Deliberate colour choices, not sampled from the image.
for r in regions:
 if r['layer']=='skin':r['color']='#fff4ed'
 if r['id'] in ['hair-main','ponytail','hair-front']:r['color']='#fff0bd'
 if r['id'].startswith('shoe-'):r['color']='#ffe090'
 if r['id']=='iris-left':r['color']='#b98fb5'
 if r['id']=='iris-right':r['color']='#b58aaa'
# Retain authored region layout and visible contour scaffold from the supplied example.
# Internal face marks are redrawn below. Ribbons now travel at arc-length speed.
excluded=set(range(110,131))|{139,140,141,142,172}
scaffold=[]
for i,c in enumerate(source['commands'][:213]):
 if i in excluded:continue
 d={k:c[k] for k in ['layer','color','width','opacity','points','note']};d['role']='lineart'
 if i<8:d['layer']='sketch';d['color']='#c4a1aa';d['width']=1
 elif i<110:d['color']='#ae8275';d['width']=1.65 if c['width']>1.3 else 1.15
 elif i<173:d['color']='#b99683';d['width']=max(.8,c['width'])
 scaffold.append(d)
paths=[]
def line(note,path,width=1.2,color='#a87d74',layer='lineart',role='lineart',clip=None,opacity=1):
 d=dict(layer=layer,path=path,width=width,color=color,role=role,note=note,opacity=opacity)
 if clip:d['clipRegion']=clip
 paths.append(d)
# Face: complete the brows, eyelids, iris structure and fingers before any colour.
for args in [
('左眉的弧度','M211 237 C222 232 237 232 246 236',1.15,'#b48d83'),
('右眉','M282 232 C293 227 306 230 313 236',1.05,'#b48d83'),
('左眼上睑','M209 264 C215 260 216 251 227 247 C237 243 247 244 252 250',2.6,'#795475'),
('左睫毛外挑','M215 261 Q209 262 205 254',2.0,'#795475'),
('左睫毛第二束','M218 255 Q212 256 210 250',1.3,'#795475'),
('左眼下睑','M216 266 C225 271 239 267 247 262',.95,'#bc8499'),
('左双眼皮','M217 247 C228 239 243 240 250 247',.85,'#c89bae'),
('左虹膜外缘','M226 249 C222 255 223 263 229 267 C235 267 239 260 238 249',1.25,'#996e9b'),
('左眼瞳孔','M231 249 C229 253 229 258 231 261',2.8,'#926991'),
('右眼上睑','M282 253 C291 243 309 244 320 256',2.35,'#825775'),
('右外眼角','M317 254 Q323 255 326 249',1.5,'#825775'),
('右眼下睑','M285 260 Q300 267 317 262',.9,'#b78193'),
('右虹膜边缘','M295 248 C291 254 292 261 298 264 C304 262 307 255 303 248',1.1,'#996e9b'),
('右瞳孔','M299 249 Q297 253 299 259',2.4,'#926991'),
('鼻尖','M269 285 Q267 287 269 288',.7,'#d8aaa3'),
('唇缝','M266 299 Q270 297 273 299',.95,'#be9291'),
('下唇','M268 302 Q271 303 274 301',.65,'#e7beb3'),
('下巴转折','M225 303 C239 313 257 322 269 323',1.15,'#b1877f'),
('脸颊右转折','M286 317 Q311 307 324 292',1.15,'#b1877f'),
('镜桥','M258 265 Q267 259 278 263',1.75,'#cd9b66'),
('左镜框上沿','M210 268 C225 259 245 256 259 262',1.8,'#dfb37d'),
('右镜框上沿','M277 258 Q302 249 326 260',1.65,'#dfb37d'),
('镜腿','M324 260 L339 253',1.5,'#cd9b66'),
('耳廓','M341 249 Q350 247 346 259 Q343 264 340 264',1.2,'#b88081'),
('耳屏','M342 254 Q338 255 336 268',.9,'#c68e8d'),
('食指压镜片','M192 315 C199 307 212 295 218 289 Q221 287 222 290',1.5,'#aa7f7c'),
('食指内缘','M193 321 L210 304 Q214 300 215 297',1.15,'#ba8c87'),
('中指关节','M190 326 Q196 321 203 320 Q210 320 214 327',1.2,'#ba8c87'),
('屈曲中指','M187 334 Q196 328 202 330 L208 338',1.2,'#ba8c87'),
('无名指','M185 340 Q192 334 199 338 L204 345',1.15,'#ba8c87'),
('小指转折','M187 346 Q195 342 198 347 L200 353',1.05,'#c08d86'),
('拇指根部','M210 337 Q211 349 203 358',1.15,'#b5807c'),
('指甲','M211 299 Q215 297 217 292',.7,'#d1a096'),
('手腕','M188 351 Q191 359 195 363',.85,'#d2a59a'),
]:line(*args)
# Hair: long contours with directional strand breaks, not stipple or texture noise.
for note,path in [
('左刘海主发束','M207 166 C190 184 188 215 179 243'),
('左刘海内束','M213 176 C204 193 204 208 207 223'),
('左侧发束顺形','M179 237 C174 257 181 277 192 288'),
('额前发束转向','M245 188 Q233 201 216 215'),
('刘海细流向','M271 199 C279 217 296 238 312 244'),
('刘海第二束','M281 196 Q295 225 310 233'),
('右侧长发内轮廓','M321 190 C340 248 319 303 328 363 C330 394 336 417 342 435'),
('右发束高处窄线','M331 184 Q344 211 343 232'),
('大马尾外束','M378 193 C399 234 400 293 422 336 C439 365 438 383 419 404'),
('马尾内束','M363 239 C354 302 376 346 399 365'),
('马尾回旋','M471 378 C470 408 423 431 400 465'),
('马尾窄束','M452 393 C438 415 404 428 391 453'),
('卷发外弧','M462 423 Q481 429 472 438'),
('卷发折返','M432 458 C437 474 460 479 463 491'),
('卷梢尖端','M464 505 Q442 516 421 523'),
('耳尖长毛','M278 42 L289 79 L282 73'),
('耳内毛束','M291 105 Q302 122 315 133 L306 119'),
('帽檐连接面','M159 153 C195 154 243 179 282 185'),
('帽冠缝线','M217 130 Q236 133 257 146'),
('尾巴长毛走向','M165 656 C132 761 129 823 153 870'),
('尾巴内侧弧线','M173 725 C149 810 157 866 196 910'),
('尾巴绕后弧线','M348 1029 Q392 1053 436 1064'),
]:line(note,path,1.05 if '细' in note or '窄' in note else 1.25,'#be986f')
# Cloth construction: seams and long folds need to read at the line-only checkpoint.
for note,path,width in [
('左肩布料受力','M143 366 Q121 382 114 402',1.25),
('袖子厚度外缘','M83 468 C91 488 115 490 140 484',1.65),
('左袖折面分界','M136 380 C126 402 134 426 145 433',1.05),
('袖口内侧厚度','M172 349 C167 372 179 391 207 404',1.4),
('左肘受力褶','M198 450 Q181 460 157 460',1.15),
('衣料下摆转折','M102 506 C86 525 89 541 81 551',1.4),
('口袋开口','M120 513 Q109 531 110 547',1.15),
('下摆斜褶','M137 548 C140 571 156 593 168 611',1.1),
('右肩叠折厚度','M334 499 Q350 487 365 488',1.6),
('右袖内侧叠折','M335 527 Q355 513 379 520',1.35),
('右肘三角褶','M364 549 Q382 555 396 555',1.15),
('右袖长面','M344 572 C341 604 345 633 355 650',1.05),
('右袖翻折下沿','M362 687 Q389 702 404 701',1.7),
('衣襟左锁骨','M238 347 Q247 350 260 352',.9),
('衣襟右锁骨','M277 348 Q292 351 306 351',.85),
('上衣左侧','M219 445 C220 476 207 510 199 528',1.0),
('衣料腰部右转折','M324 466 C316 490 323 521 327 533',1.0),
('胯部左边缝','M195 549 C216 578 232 608 247 634',1.15),
('胯部右边缝','M324 538 C302 565 289 609 276 633',1.15),
('衣料底端','M249 638 Q261 644 274 638',1.0),
('左膝浅轮廓','M201 785 Q208 803 220 805',.65),
('左膝内侧','M242 803 Q252 801 254 789',.65),
('右膝浅轮廓','M290 802 Q297 822 310 821',.65),
('右膝内侧','M319 822 Q328 817 330 804',.65),
('左足踝','M210 1013 Q221 1029 239 1021',.75),
]:line(note,path,width,'#b89082' if width>1 else '#d0aaa0')
# Shoe fastenings and seams (genuinely small objects, not residual marks).
for dx,dy in [(0,0),(80,6)]:
 def shift(d):
  import re
  ts=re.findall(r'[MLQCZ]|-?\d+(?:\.\d+)?',d);coord=0;result=[]
  for t in ts:
   if t.isalpha():result.append(t);coord=0
   else:result.append(str(float(t)+(dx if coord%2==0 else dy)));coord+=1
  return ' '.join(result)
 for note,d,w in [
 ('鞋口翻边','M210 1038 Q233 1054 262 1040',1.5),
 ('鞋口内沿','M215 1036 Q237 1046 257 1038',.9),
 ('脚背系带上沿','M213 1085 Q237 1077 264 1087',1.4),
 ('脚背系带下沿','M212 1092 Q239 1083 266 1096',1.1),
 ('鞋带金属扣','M215 1085 L223 1083 L223 1091 L215 1093 Z',.9),
 ('鞋面第二扣','M253 1084 L262 1087 L263 1096 L254 1092 Z',.9),
 ('鞋底厚度','M209 1150 Q230 1165 270 1152',1.35),
 ('鞋底曲面','M215 1160 Q238 1171 263 1161',.85),
 ('鞋面褶皱','M221 1058 Q215 1067 227 1078',.9),
 ]:line(note,shift(d),w,'#c19762')
# Outline the small ponytail stars before flat painting.
starshapes=[]
for x,y in [(400,275),(370,337),(456,362),(407,412)]:
 d=f'M{x} {y-5} L{x+2} {y-1} L{x+5} {y} L{x+1} {y+2} L{x} {y+6} L{x-2} {y+2} L{x-5} {y} L{x-2} {y-1} Z'
 line('马尾星饰轮廓',d,.85,'#be9b9b');starshapes.append({'clipRegion':'ponytail','path':d,'color':'#fff9f0','layer':'rear_hair-light','note':'整颗星饰，放在马尾修色层'})
# Hand-authored overpainting: retain large planes from example, then refine forms.
shadows=[]
for c in source['commands'][258:309]:
 r=rmap[c['clipRegion']]
 shadows.append({'clipRegion':r['id'],'path':c['path'],'color':c['color'],'opacity':.62 if r['layer'] in ['skin','hair'] else .74,'note':c['note'],'layer':r['shadeLayer']})
def shape(r,path,color,opacity=1,note='',pass_='shade'):
 shadows.append({'clipRegion':r,'path':path,'color':color,'opacity':opacity,'note':note or r+' · 明确的转折暗面','layer':rmap[r]['shadeLayer' if pass_=='shade' else 'lightLayer']})
shape('hair-main','M180 163 Q200 150 220 166 C199 187 197 216 181 228 L165 234 Q166 191 180 163 Z','#bd936f',.32,'刘海根部受帽檐遮挡')
shape('hair-main','M230 181 Q241 172 256 181 L267 199 Q251 184 230 208 Z','#c29a82',.32,'额前发束投影')
shape('hair-front','M327 229 C331 277 319 320 326 363 L333 405 L327 391 C311 322 324 284 323 253 Z','#bb9879',.25,'长发内缘窄暗面')
shape('ponytail','M371 207 C375 262 391 306 402 331 Q413 353 428 372 L427 383 C394 356 373 312 363 276 Z','#d8b486',.38,'马尾主转面')
shape('ponytail','M442 341 Q475 379 467 399 Q442 419 425 427 C446 401 457 391 453 374 Z','#d5b088',.32,'马尾卷面背光')
shape('sleeve-left','M139 365 C122 402 130 427 150 440 Q134 436 129 421 Q117 392 139 365 Z','#d5ba88',.4,'袖口下方受力暗面')
shape('sleeve-left','M97 475 Q111 470 125 477 L112 484 L95 482 Z','#c9a786',.35,'袖肘折返')
shape('sleeve-right','M329 514 Q341 501 359 505 L343 520 L340 539 L330 535 Z','#b58e76',.42,'多层衣料夹角遮蔽')
shape('sleeve-right','M349 537 Q372 530 391 535 L402 550 Q384 540 370 540 Z','#d8b183',.5,'袖口翻折第二面')
shape('sleeve-right','M340 582 Q350 606 358 624 L352 635 L341 625 Z','#c6a67e',.34,'长袖弯折面')
shape('suit','M221 373 Q231 399 223 439 L217 455 L217 410 Z','#e1d9e2',.3,'白布的冷灰转面')
shape('suit','M268 364 L275 386 Q271 393 264 391 Z','#ded4df',.22,'领口薄投影')
shape('torso','M257 306 Q270 320 290 307 L287 323 L258 323 Z','#ba8d95',.32,'下颌投影')
shape('face','M211 215 Q230 190 256 188 L264 202 Q244 194 224 215 Z','#e9c3b1',.35,'刘海投影')
shape('face','M211 283 Q224 296 243 291 L249 300 Q230 303 216 291 Z','#e3a8a4',.2,'脸颊暖色转面')
shape('left-leg','M247 652 C245 705 250 760 246 788 L254 802 Q260 763 255 738 L255 667 Z','#d6aab0',.18,'大腿内侧长转面')
shape('right-leg','M276 664 C279 728 277 777 285 816 L291 811 Q285 760 285 701 Z','#d6aab0',.2,'腿部内缘长转面')
shape('hand','M211 300 L217 293 L219 298 L212 309 L215 315 L210 321 L204 316 Z','#d1a5a1',.24,'手指叠压投影')
# Coloured corrections are intentionally on top of shadow layers.
corrections=starshapes[:]
def correction(r,path,col,opacity=1,note='局部修色'):
 corrections.append({'clipRegion':r,'path':path,'color':col,'opacity':opacity,'layer':rmap[r]['lightLayer'],'note':note})
correction('iris-left','M226 258 Q231 254 238 257 Q237 266 230 266 Z','#dfb9cf',1,'虹膜下半部透光')
correction('iris-right','M294 256 Q300 254 305 257 L301 263 L296 262 Z','#e3b7cf',1,'右虹膜下半部透光')
correction('lens-left','M215 279 L253 268 Q250 284 236 291 Q222 291 215 279 Z','#ffc69b',.55,'镜片下半部暖反射')
correction('lens-right','M282 269 L320 267 Q315 281 301 286 Q288 282 282 269 Z','#ffbca0',.4,'镜片下半部暖反射')
correction('visor','M157 145 Q193 144 230 158 L231 162 Q192 148 169 151 Z','#fff5ce',.9,'帽檐亮面完整覆盖')
correction('shoe-left','M211 1147 Q238 1160 272 1147 L272 1155 Q235 1169 209 1156 Z','#fff1b7',.9,'鞋底高光带')
correction('shoe-right','M291 1153 Q318 1166 352 1153 L351 1161 Q315 1175 289 1162 Z','#fff1b7',.9,'鞋底高光带')
correction('hem-left','M95 598 L140 614 L140 624 L95 609 Z','#d76663',1,'外套下摆徽标底色')
# Model-painted long highlight ribbons, separate from any area's base colour.
lights=[]
def light(r,note,d,w,col='#fff9df',alpha=.9):lights.append(dict(layer=rmap[r]['lightLayer'],path=d,width=w,color=col,role='highlight',clipRegion=r,opacity=alpha,note=note))
for r,note,d,w in [
 ('ponytail','马尾主亮面','M371 199 C381 250 385 301 408 343',10),
 ('ponytail','顺着回旋留一道亮边','M468 389 C451 414 416 435 397 465',7),
 ('hair-front','前发长高光','M321 192 C335 249 316 311 330 370',5),
 ('hair-main','额前发束亮边','M226 194 Q218 201 211 209',5),
 ('hair-main','刘海长亮边','M284 202 Q298 227 315 237',6),
 ('hair-side-left','侧发亮面','M179 250 Q179 273 191 286',6),
 ('sleeve-left','左袖大亮面','M126 388 C109 414 107 438 119 448',22),
 ('sleeve-left','袖口厚度亮边','M175 353 C174 373 188 389 210 398',3),
 ('sleeve-right','右袖顺布料留亮面','M367 579 Q376 623 397 651',26),
 ('jacket-back','后片亮面','M121 528 Q119 550 136 568',12),
 ('left-leg','左大腿受光','M209 645 Q201 716 211 761',16),
 ('right-leg','右大腿受光','M310 650 Q300 721 309 777',18),
 ('right-leg','小腿前面长亮部','M313 852 C326 909 327 962 320 992',12),
 ('tail','尾巴宽亮面','M169 686 C147 765 149 825 172 873',13),
 ('tail','下方尾尖弧形反光','M75 1176 C157 1209 317 1230 371 1227',6),
 ('shoe-left','鞋带受光','M219 1105 Q240 1100 260 1109',3),
 ('shoe-right','鞋带受光','M299 1111 Q320 1106 340 1115',3),
]:light(r,note,d,w, '#fff8f0' if r in ['left-leg','right-leg'] else '#fff9df',.72)
# Final selective line accents: small number of strong occlusion edges, never redraw all contours.
finish=[]
def accent(note,d,w,col):finish.append(dict(layer='finish',path=d,width=w,color=col,role='finish',note=note))
for args in [
 ('最后压左眼睑','M211 263 C220 250 233 242 248 248',2.3,'#825879'),
 ('最后压右眼睑','M284 253 Q302 243 319 255',1.8,'#825879'),
 ('手指遮挡边','M194 315 Q208 300 217 291',1.35,'#a77c77'),
 ('帽檐叠压边','M218 177 Q263 195 297 196',1.5,'#bc9069'),
 ('左袖与躯干遮挡','M188 475 Q205 466 213 455',1.7,'#aa856e'),
 ('右袖夹缝','M338 530 Q355 519 378 522',1.6,'#b28768'),
 ('长发末端转折','M335 428 L345 454 L355 445',1.15,'#b0866b'),
 ('镜片左反光','M219 270 L242 264',2.1,'#fff9ec'),
 ('镜片右反光','M301 256 L319 268',3.2,'#fff9ec'),
 ('镜片左小反光','M216 274 L225 271',1.1,'#fff9ec'),
 ('左眼光点','M230 250 L230 254',2.4,'#fffaf6'),
 ('右眼光点','M298 250 L298 253',2.1,'#fffaf6'),
 ('帽饰瞳孔','M303 172 Q301 177 305 181',4,'#796275'),
 ('帽饰反光','M297 165 L298 168',2,'#ffffff'),
 ('鞋履金属边','M212 1162 Q237 1176 264 1165',1.3,'#efbd65'),
 ('下摆徽标一','M102 603 L102 610 L108 612 L108 605',2.2,'#fff8e3'),
 ('下摆徽标二','M114 607 L114 614 L120 616 L120 609',2.1,'#fff8e3'),
 ('下摆徽标三','M126 611 L126 618 L133 620',2.1,'#fff8e3'),
]:accent(*args)
plan=dict(title='黄衣角色 · v6 模型笔触研究',width=586,height=1248,layers=layers,regions=regions,groups=groups,stages=[{'id':i,'name':n,'description':d} for i,n,d in [('lineart','完整线稿','轮廓、五官、手指、发束和衣褶；先检查再铺色'),('flats','大色块铺底','每个完整部件一次底色'),('shadow','叠加大暗面','阴影在部件底色上单独叠放'),('light','顺形修色','沿发束和衣料伸展的长笔触'),('correct','小修与配饰','眼睛、镜片、金属和局部亮面'),('finish','最后压线','只加强关键遮挡边与五官')]])
files={'plan':plan,'scaffold':scaffold,'lines':paths,'flats':[{'region':r['id'],'color':r['color'],'opacity':r.get('opacity',1)} for r in regions],'shadows':shadows,'lights':lights,'corrections':corrections,'finish':finish}
for name,data in files.items():(out/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print({k:len(v) if isinstance(v,list) else len(v.get('regions',[])) for k,v in files.items()})
