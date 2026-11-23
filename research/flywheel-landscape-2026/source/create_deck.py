from pathlib import Path
import shutil, yaml

WORK=Path(__file__).resolve().parent
ROOT=WORK.parent/'slides'
PAGES=ROOT/'pages'; MEDIA=ROOT/'media'
for d in (PAGES,MEDIA): d.mkdir(parents=True,exist_ok=True)
assets={
 'product_map.png':WORK/'assets/01_product_duration_map.png',
 'speed_window.png':WORK/'assets/02_speed_energy_window.png',
 'hybrid_split.png':WORK/'assets/03_hybrid_power_split.png',
 'maturity.png':WORK/'assets/04_application_maturity.png',
 'active_power.png':WORK/'images/1_Additional_sustainability_benefits.png',
 'dinglun.png':WORK/'images/2_World_s_largest_flywheel_energy_storage.png',
 'durastor.png':WORK/'images/3_DuraStor_Stornetic.png',
 'amber.png':WORK/'images/4_Episode_43_Fantastic_Flywheels_Amber.png',
 'enwheel.png':WORK/'images/7_EnWheel_Stornetic.png',
}
for name,src in assets.items(): shutil.copy2(src,MEDIA/name)

W,H=960,540
C={'dark':'#183B36','primary':'#24534C','copper':'#A85F36','text':'#27312F','muted':'#65716D','line':'#D6DDD9','pale':'#EDF2EF','warm':'#F5F1EA','white':'#FFFFFF'}
def fill(color): return {'type':'solid','color':color}
def text(eid,x,y,w,h,s,size=14,color='$text',bold=False,align='left',valign='top',lh=1.22,wrap=True):
 return {'elementId':eid,'elementType':'text','bounds':[x,y,w,h],'content':{'text':s,'fontSize':size,'color':color,'bold':bold,'fontFamily':'MiSans','lineHeight':lh,'align':[align,valign],'wrap':wrap}}
def rect(eid,x,y,w,h,color='$pale',border=None):
 d={'elementId':eid,'elementType':'shape','bounds':[x,y,w,h],'shapeName':'rect','fill':fill(color)}
 if border: d['border']={'style':'solid','width':1,'color':border}
 return d
def rule(eid,x,y,w,color='$line',h=1): return rect(eid,x,y,w,h,color)
def vrule(eid,x,y,h,color='$line',w=1): return rect(eid,x,y,w,h,color)
def image(eid,x,y,w,h,src,mode='cover'):
 return {'elementId':eid,'elementType':'image','bounds':[x,y,w,h],'src':'media/'+src,'fit':{'mode':mode}}
def icon(eid,x,y,w,h,name,color='$primary'):
 return {'elementId':eid,'elementType':'icon','bounds':[x,y,w,h],'iconName':name,'fill':fill(color)}
def arrow(eid,x,y,w,h=1,color='$primary'):
 vertical=h>w
 bw,bh=(max(w,2),h) if vertical else (w,max(h,2))
 pts=f'{bw/2},0 {bw/2},{bh}' if vertical else f'0,{bh/2} {bw},{bh/2}'
 return {'elementId':eid,'elementType':'line','bounds':[x,y,bw,bh],'viewBox':[bw,bh],'points':pts,'curve':'sharp','arrow':[None,'stealth'],'border':{'style':'solid','width':1.5,'color':color}}
def table(eid,x,y,w,h,headers,rows,widths=None,rowhs=None,fs=11.5):
 n=len(headers); widths=widths or [1/n]*n
 data=[[{'text':z,'bold':True,'color':'#FFFFFF','fontSize':fs,'align':['left','middle']} for z in headers]]
 for row in rows:
  data.append([{'text':str(z),'fontSize':fs,'align':['left','middle'],'bold':(i==0)} for i,z in enumerate(row)])
 return {'elementId':eid,'elementType':'table','bounds':[x,y,w,h],'columnWidths':widths,'rowHeights':rowhs or [1/(len(rows)+1)]*(len(rows)+1),'rows':data,'style':'$default'}
def base(title,section,num,source='',subtitle=None):
 e=[text('section',44,20,680,16,section,9.5,'$copper',True),text('title',44,44,872,54,title,25,'$dark',True,lh=1.1),rule('title-rule',44,101,872,'$primary',2)]
 if subtitle: e.append(text('subtitle',44,108,872,28,subtitle,11.5,'$muted'))
 e += [rule('footer-rule',44,506,872),text('source',44,513,790,14,source,8.2,'$muted',wrap=False),text('page',866,513,50,14,f'{num:02d} / 32',8.5,'$muted',align='right',wrap=False)]
 return e
def write_page(num,name,elements,pageType='content',bg='$white'):
 obj={'pageType':pageType,'background':fill(bg),'elements':elements}
 fn=f'pages/{num:02d}_{name}.page'
 with open(ROOT/fn,'w',encoding='utf-8') as f: yaml.safe_dump(obj,f,allow_unicode=True,sort_keys=False,width=1000)
 return fn
pages=[]
def add(num,name,elements,pageType='content',bg='$white'):
 assert len(pages)==num-1,(num,len(pages))
 pages.append(write_page(num,name,elements,pageType,bg))

def node(e,eid,x,y,w,h,title,body='',accent=False):
 e.append(rect(eid+'-bg',x,y,w,h,'$warm' if accent else '$pale','$copper' if accent else '$line'))
 e.append(text(eid+'-title',x+10,y+8,w-20,22,title,13,'$copper' if accent else '$primary',True))
 if body: e.append(text(eid+'-body',x+10,y+33,w-20,h-38,body,10.5,'$text',lh=1.18))

# 1 Cover
e=[rect('left',0,0,534,540,'$dark'),image('cover-img',534,0,426,540,'dinglun.png'),
   text('kicker',52,52,420,20,'技術・產業・證據整合',12,'#D7B79F',True),
   rule('cover-rule',52,92,74,'#D7B79F',3),
   text('cover-title',52,126,430,116,'飛輪儲能\n技術全景',39,'#FFFFFF',True,lh=1.08),
   text('cover-sub',52,260,420,80,'學術研究、專利版圖、代表廠商與商業產品\n鋰電／氫能整合及 2027–2031 發展情境',17,'#E6ECE9',lh=1.35),
   text('cover-date',52,418,420,22,'研究截點｜2026 年 10 月 30 日',12,'#D7B79F',True),
   text('cover-note',52,452,420,36,'商業運轉・示範／試點・學術模擬・前瞻假設分層呈現',10.5,'#E6ECE9'),
   rect('img-caption-bg',548,490,398,34,'#183B36CC'),text('img-caption',558,499,380,16,'圖：鼎輪 30 MW 飛輪專案｜Energy-Storage.news',8.5,'#FFFFFF',wrap=False)]
add(1,'封面',e,'cover')

# 2 Summary
e=base('飛輪的價值在功率與循環，不在取代所有長時儲能','決策摘要',2,'來源：本報告綜合 DOE、官方產品資料、Scholar 文獻與專案資料；截至 2026-10-30。')
e += [text('lead',44,119,872,42,'2026 年最可採購的主軸是 UPS、調頻與飛輪－鋰電；小時級純飛輪和氫能耦合要逐案驗證。',16,'$primary',True),
 table('summary-table',44,178,872,260,['判斷','證據','決策含義'],[
  ['UPS／關鍵電力最成熟','Active Power、Piller、VYCON 長期產品線','按負載橋接與維護驗收，而非比 kWh'],
  ['20–30 MW 調頻陣列可行','Beacon 兩站、鼎輪 30 MW 併網','收益取決市場規則、可用率與待機電費'],
  ['飛輪－鋰電已多國部署','荷蘭 FCR、中國朔州／綿陽／文水','以電池衰退和混合效率做同場驗證'],
  ['長時純飛輪仍是利基','Amber 4 h；新創路線成熟度不一','要求多場站、多年、第三方實績'],
  ['飛輪－氫能以示範／模擬為主','Raglan、Utsira；2024–2025 研究','飛輪做平滑與故障支撐，不提供季節能量']
 ],[.25,.37,.38],fs=12),
 text('bottom',44,455,872,32,'選型順序：任務譜 → 有效能量與功率 → 待機與維護 → 安全圍堵 → 市場收益。',14,'$copper',True)]
add(2,'決策摘要',e)

# 3 Method
e=base('四層證據標籤，讓「能做」與「已商轉」不再混用','研究方法',3,'來源：本報告研究方法；Scholar、天眼查、DOI、官方產品頁與政府專案頁交叉核對。')
levels=[('01','商業運轉','產品銷售、併網或持續服務','支持特定案例商業可行性'),('02','示範／試點','特定系統整合已實作','不支持量產成本與長期可靠度'),('03','模擬／概念','比較控制、容量與物理機制','不支持實測效率、壽命或收益'),('04','前瞻假設','建立情境與觀察指標','不是市場承諾或確定預測')]
y=142
for i,(n,t,b,lim) in enumerate(levels):
 e += [text(f'n{i}',44,y,48,28,n,20,'$copper',True),text(f't{i}',104,y,160,24,t,15,'$primary',True),text(f'b{i}',270,y,300,38,b,12),text(f'l{i}',600,y,316,38,lim,11.5,'$muted'),rule(f'r{i}',44,y+55,872)]
 y+=76
e += [text('method',44,458,872,28,'專利為代表性抽樣，不是全球普查或 FTO；工商存續不等同產品通過驗收。',12,'$copper',True)]
add(3,'證據分級',e)

# 4 Product map
e=base('UPS、分鐘級調頻與小時級能量型是三條不同賽道','技術定位',4,'來源：各廠商官方規格；對數座標。能量與放電時間口徑不同，圖用於定位而非性能排名。')
e += [image('map',44,122,610,342,'product_map.png','contain'),vrule('split',678,132,318),
 text('read-title',702,132,214,24,'讀圖後的三個判斷',15,'$primary',True),
 text('read1',702,176,214,68,'① UPS 以秒級高功率橋接為核心，kWh 小不代表技術低階。',12.5),
 text('read2',702,258,214,68,'② 調頻重視高循環、反應與 SOC 恢復，收益不是單看效率。',12.5),
 text('read3',702,340,214,74,'③ 4 h 飛輪需獨立評估待機、成本、量產與長期實績。',12.5),
 text('note',44,474,872,20,'產品規格優先保留原廠單位與量測邊界；不對不同效率口徑做單一排名。',10.5,'$muted')]
add(4,'產品定位圖',e)

# 5 Architecture
e=base('整機性能由六個子系統共同決定，故障要能在單元內隔離','系統架構',5,'來源：Bolund 2007；Xu 2023；Stornetic EnWheel 官方剖面。架構為本報告整理。')
e += [image('enwheel',584,128,332,230,'enwheel.png','contain'),text('imgcap',584,362,332,28,'EnWheel 剖面：轉子、磁軸承、電機與真空腔整合',9.5,'$muted',align='center')]
coords=[(44,140,'轉子＋圍堵','儲能／超速與碎片防護'),(232,140,'軸承＋備援','支承／受控降速'),(44,248,'真空＋熱管理','降風損／散熱與漏率'),(232,248,'電機＋變流器','四象限／直流母排'),(138,356,'EMS＋陣列控制','SOC、功率分配、故障隔離')]
for i,(x,y,t,b) in enumerate(coords): node(e,f'n{i}',x,y,168,78,t,b,i==4)
e += [arrow('a1',212,178,20),arrow('a2',212,286,20),arrow('a3',120,218,1,30),arrow('a4',308,218,1,30),arrow('a5',222,326,1,30),
 text('flow',584,404,332,66,'正常：指令 → 陣列分配 → 單機控制\n異常：限功率 → 受控降速 → 單元隔離\n恢復：原因確認後才允許重新加速',11.5,'$text',lh=1.3)]
add(5,'系統架構',e)

# 6 Rotor
e=base('轉子設計比的是有效能量與安全裕度，不是最高 rpm','關鍵部件',6,'來源：Hu et al. 2023；Dragoni 2019。右圖依 E∝ω² 計算，非特定產品實測。')
e += [table('rotor',44,126,500,242,['路線','優勢','主要風險','適用情境'],[
 ['高強鋼／疊片鋼','加工與大尺寸成熟','質量、臨界轉速、疊片與渦流','長時／UPS'],
 ['碳纖維複材','高比強度、高速','接合、蠕變、疲勞與爆裂','高頻／緊湊'],
 ['混凝土＋玻纖','材料成本低','固化、裂縫、檢測與一致性','長時概念']
 ],[.25,.25,.31,.19],fs=11.2),image('speed',574,124,342,246,'speed_window.png','contain'),
 text('formula',44,394,500,44,'可用能量比例＝1−(ωmin／ωmax)²\n最低轉速 50% → 理想可用能量 75%',15,'$copper',True),
 text('checks',574,394,342,66,'採購必看：額定／最高／最低轉速、材料批次、疲勞任務譜、超速與全尺寸圍堵試驗。',12)]
add(6,'轉子取捨',e)

# 7 Bearings and standby
e=base('待機損耗會改寫商業模型，必須把輔機納入效率邊界','關鍵部件',7,'來源：Amiryar & Pullen 2020；Venturini 2024；Liu et al. 2026。')
e += [table('bearing',44,126,872,184,['方案','優勢','失效／維護重點','採購判斷'],[
 ['機械／陶瓷軸承','簡單、無主動懸浮功耗','高速發熱、潤滑與定期更換','適合成熟 UPS；算入維護成本'],
 ['被動磁／永磁卸載','降低接觸負載','剛度、阻尼、渦流與退磁','無接觸不等於零損耗'],
 ['主動磁軸承','五自由度、適合高速','放大器、感測、控制與備援落地','要求整機功耗與故障測試'],
 ['超導磁軸承','穩定被動懸浮','低溫、冷卻、磁通蠕變與失超','把冷卻功耗與可靠度納入']
 ],[.19,.23,.30,.28],fs=11.2),
 text('loss-title',44,336,250,24,'待機損耗的四個來源',15,'$primary',True),
 text('losses',44,372,410,84,'風損｜隨真空度與轉速非線性變化\n磁軸承｜偏置、銅損、鐵損與放大器\n電機｜高速空載與鐵損\n輔機｜真空、冷卻、控制與站用電',12.2,lh=1.35),
 vrule('v',492,338,126),text('accept',520,338,396,122,'驗收不要只問峰值效率\n\n要求 24 h／72 h 能量保持、平均待機 kW、四季站用電、真空恢復時間與輔機維護週期。',13,'$copper',True,lh=1.3)]
add(7,'軸承與待機',e)

# 8 Power electronics
e=base('電機與變流器決定功率品質，陣列 EMS 決定可用率與老化','電機與控制',8,'來源：Takarli et al. 2023；Xu et al. 2023；代表陣列專利 CN117200282B、CN122512415A。')
# architecture
node(e,'grid',44,178,148,88,'電網／關鍵負載','有功、無功、頻率與故障要求',True)
node(e,'pcs',260,178,158,88,'網側變流器','直流母排、併網電流與保護')
node(e,'machine',486,178,158,88,'機側變流器＋電機','轉矩、速度、四象限充放電')
node(e,'rotor',712,178,160,88,'飛輪單元陣列','轉速／SOC、溫度、振動與健康')
e += [arrow('p1',192,220,68),arrow('p2',418,220,68),arrow('p3',644,220,68),
 text('ems',260,310,384,28,'站級 EMS：依 SOC、效率、溫度、振動與累積疲勞分配功率',13,'$primary',True,align='center'),
 arrow('control',452,282,1,28,'$copper'),
 table('controls',44,376,872,88,['控制層','正常功能','異常／降級路徑'],[
 ['單機','速度／電流控制、SOC 估計、保護','限功率 → 受控降速 → 備援軸承'],
 ['站級','AGC／一次調頻、無功、SOC 恢復','通訊中斷切本地 droop；故障機隔離'],
 ['構網','建立電壓／頻率參考','必須同時標示可持續功率與能量窗口']
 ],[.16,.40,.44],fs=10.8)]
add(8,'功率電子與控制',e)

# 9 Metrics
e=base('先統一能量與效率口徑，產品比較才有意義','規格比較',9,'來源：Stornetic、Active Power、VYCON、Amber 官方資料。換算：1 kWh＝3.6 MJ＝3,600 kW·s。')
e += [text('conversion',44,126,872,46,'6,000 kW·s ≈ 1.67 kWh　｜　6.2 MJ ≈ 1.72 kWh　｜　動能 ≠ 有效放電能',19,'$copper',True,align='center'),
 table('metrics',44,192,872,236,['欄位','正確比較','常見誤讀','本報告處理'],[
 ['功率 kW／MW','持續、過載與併網點分開','峰值當持續','保留時間與配置條件'],
 ['能量 kWh／MJ','先換算，再確認有效／動能','最高轉速動能當可用能','保留原單位與有效能量'],
 ['放電時間','指定功率與負載曲線','能量÷功率套用全部負載','UPS 明示依負載變化'],
 ['效率','DC／AC／UPS／含輔機分開','單程當 AC 往返','不做跨口徑效率排名'],
 ['壽命／循環','DoD、任務譜、維護一起比','設計壽命當保固','標示設計目標與廠商口徑']
 ],[.18,.30,.23,.29],fs=11.2),
 text('takeaway',44,450,872,28,'同場驗收應以「有效能量＋含輔機效率＋待機 kW」三項一起比。',13,'$primary',True)]
add(9,'規格比較口徑',e)

# 10 Safety
e=base('無燃燒不等於無風險：高速機械能需要獨立安全論證','安全與圍堵',10,'來源：Pichot 1997；Sandia flywheel safe design practices；Amber 地埋陣列專利。')
e += [text('hazard',44,126,220,28,'危險源',15,'$primary',True,align='center'),text('prevention',370,126,220,28,'預防與降速',15,'$primary',True,align='center'),text('mitigation',696,126,220,28,'後果控制',15,'$primary',True,align='center')]
node(e,'h1',44,174,220,92,'過速／材料缺陷','高能碎片、腔體破裂、軸向與徑向載荷',True)
node(e,'p1',370,154,220,70,'材料與疲勞裕度','批次檢測、任務譜與 NDT')
node(e,'p2',370,238,220,70,'獨立超速保護','限功率、受控降速、備援軸承')
node(e,'m1',696,174,220,92,'圍堵與單元隔離','全尺寸破壞模式、鄰機間距與救援程序',True)
e += [arrow('a1',264,218,106),arrow('a2',590,218,106),
 table('safety-tests',44,352,872,110,['故障注入','必須觀察','通過條件'],[
 ['磁軸承斷電／放大器失效','位移、振動、備援落地與陣列重分配','單元安全隔離，不擴大為整站事故'],
 ['真空喪失／冷卻失效','風損、溫升、降功率與自然降速','在材料與軸承限值內受控停機'],
 ['通訊中斷／錯誤指令','本地安全控制、重連與資料留存','不持續滿功率追逐錯誤指令']
 ],[.25,.39,.36],fs=10.8)]
add(10,'安全圍堵',e)

# 11 Literature map
e=base('研究重心已由單機部件，延伸到陣列、壽命與混合控制','學術現況',11,'來源：Scholar 文獻盤點；DOI 對照。完整 18 篇文獻與限制見 Word 報告第 5 章。')
e += [table('literature',44,124,872,304,['時期／代表文獻','主題','可支持的結論','證據邊界'],[
 ['2007–2021｜Bolund、Amiryar、Mousavi、Olabi','系統與應用','建立轉子—軸承—電機—真空—變流框架','經典綜述；市場與成本資料較舊'],
 ['2023｜Hu、Takarli、Xu','材料／電機／高速磁懸浮','部件設計與系統鏈整合更完整','綜述不等同產品實測'],
 ['2024｜Venturini、Dai、Wang','風損、中國研發、混合調頻','由模型走向台架與 SOC 約束控制','特定台架／策略不可隨意外推'],
 ['2026｜Liu、Hashim、Han','磁軸承節能、疲勞 MPC、電池衰退','健康與壽命進入控制目標','多為研究驗證，缺多年電站資料']
 ],[.29,.20,.29,.22],fs=11.2),
 text('trend',44,452,872,28,'判讀原則：文獻數量增加代表研究活躍，不代表商業成熟度同步提高。',13,'$copper',True)]
add(11,'學術文獻地圖',e)

# 12 Frontiers
e=base('2024–2026 的前沿，集中於低損耗、健康感知與衰退導向','研究前沿',12,'來源：Liu 2026；Hashim 2026；Wang 2024；Han 2026；Venturini 2024。')
front=[('低功耗磁軸承','永磁偏置、銅損／鐵損與控制功耗聯合降低','整機待機 kW，而非軸承本體摩擦'),('風損實測','自然降速與非侵入式量測校準模型','長時間能量保持曲線'),('疲勞壽命感知 MPC','把轉子與軸承健康納入控制','實際任務譜、振動與維護工單校準'),('混合衰退控制','SOC 約束、模糊 PI、電池損傷成本','同場純鋰電基準與容量／內阻衰退')]
y=130
for i,(t,b,k) in enumerate(front):
 e += [text(f'fnum{i}',44,y,40,26,f'{i+1:02d}',18,'$copper',True),text(f'ft{i}',96,y,196,26,t,14,'$primary',True),text(f'fb{i}',304,y,330,50,b,11.8),text(f'fk{i}',664,y,252,50,'驗收：'+k,11.2,'$muted'),rule(f'fr{i}',44,y+62,872)]
 y+=82
e += [text('front-note',44,466,872,22,'研究方向正確，但研究控制器不能替代多年場站可靠度與第三方性能。',11.5,'$copper',True)]
add(12,'研究前沿',e)

# 13 Gaps
e=base('五個證據缺口，決定哪些結論仍不能下定論','研究缺口',13,'來源：本報告對公開論文、產品資料與專案揭露的交叉檢查；截至 2026-10-30。')
e += [table('gaps',44,126,872,296,['缺口','目前公開資料','為什麼重要','下一步證據'],[
 ['複材長期老化','多為材料與部件研究','影響壽命、接合與爆裂模式','濕熱／真空／熱循環多年任務譜'],
 ['全尺寸圍堵','公開爆裂與鄰機隔離資料有限','決定間距、土建與救援成本','最壞破壞模式與第三方試驗'],
 ['長期待機與可用率','峰值效率多、全年站用電少','低利用率場站由待機主導成本','逐季功耗、停機原因與維護工時'],
 ['第三方經濟性','缺少同市場同任務 A/B','固定壽命改善倍率不可外推','純鋰電／純飛輪／混合全成本對照'],
 ['大型氫能實證','微電網示範與模擬為主','電解槽動態與氫安全會改變設計','真實電解槽連續運轉與故障恢復']
 ],[.20,.27,.25,.28],fs=11.2),
 text('gap-bottom',44,448,872,34,'因此，本報告不給單一全球市場規模、統一 LCOS 排名或固定電池壽命改善倍率。',13,'$copper',True)]
add(13,'研究缺口',e)

# 14 Patent clusters
e=base('專利壁壘從轉子與真空，擴展到陣列調度與混合控制','專利版圖',14,'來源：天眼查、Justia、Google Patents 代表性抽樣；不是全球專利普查或 FTO 法律意見。')
clusters=[('轉子／輪轂','複材纏繞、疊片鋼、纖維方向與接合','US12078221B2｜US11362558B2'),('磁軸承','磁卸載、超導、五自由度與電機磁路整合','US9892839B2｜CN122678386A'),('真空／熱','密封、分子泵、輻射與熱管散熱','US11085420B2｜CN108900039B'),('電機／變流','定子常壓、高速電機、高壓直流','US11682943B2｜CN122338713A'),('陣列／構網','地埋陣列、健康調用、風電耦合','CN122512415A｜CN122823458B'),('混合／氫能','電池損傷分配、飛輪增量制氫','CN122697432A｜CN116040917A')]
y=124
for i,(t,b,p) in enumerate(clusters):
 e += [text(f'pc{i}',44,y,130,24,t,13,'$primary',True),text(f'pb{i}',184,y,422,38,b,11.5),text(f'pp{i}',632,y,284,38,p,10.5,'$muted'),rule(f'pr{i}',44,y+46,872)]
 y+=57
e += [text('patent-note',44,474,872,18,'申請公開 ≠ 授權；授權 ≠ 持續有效；專利存在 ≠ 商業化。',11.5,'$copper',True)]
add(14,'專利技術分群',e)

# 15 Patents table
e=base('法律狀態必須逐件核查，新案與舊案不能用同一把尺解讀','代表專利',15,'來源：Google Patents、Justia；法律狀態為 2026-10-30 抽樣快照，後續可能改變。')
e += [table('patents',44,122,872,326,['公開號','主題／申請人','狀態','技術判讀'],[
 ['US12078221B2','全複材纏繞轉子｜Clegern','授權 2024','FEA 與幾何設計，不代表產品運轉'],
 ['CN108869543B','混合超導磁軸承｜中科院電工所','2024 年費終止','曾授權不等於權利仍有效；查同族'],
 ['CN108900039B','真空轉子散熱｜工程熱物理所','授權 2024','輻射散熱與熱管，連接待機與熱設計'],
 ['US10693342B2','地埋式飛輪陣列｜Amber','授權 2020','多單元配置與安全容納'],
 ['CN122512415A','健康感知陣列調用｜坎德拉','實質審查','由單機控制走向可用度／健康調度'],
 ['CN122823458B','構網風電耦合｜內蒙古工業大學等','授權 2026-10-27','飛輪與構網型風電參數協同'],
 ['CN122697432A','電池損傷導向分配｜瀋陽微控','實質審查','把衰退成本納入混合功率分配'],
 ['CN116040917A','飛輪增量電解制氫｜浙江榮越','實質審查','研發布局，不是商業部署證據']
 ],[.19,.31,.18,.32],fs=10.5),
 text('fto',44,464,872,24,'正式產品開發仍需逐國、逐權利項检查同族、延續、轉讓、無效與訴訟。',11.5,'$copper',True)]
add(15,'代表專利',e)

# 16 Vendors
e=base('供應商選擇要同時看產品、資產歸屬與長期服務責任','全球廠商',16,'來源：公司官方資料、Langley、Calnetix、Beacon 資產公告；截至 2026-10-30。')
e += [table('vendors',44,122,872,314,['廠商／組織','定位','2026 狀態判讀','採購重點'],[
 ['Active Power／Piller','UPS／關鍵電力','成熟產品線，Langley 體系','整機、旁路、發電機與服務'],
 ['VYCON／Calnetix','直流母排 UPS','成熟產品線','kW·s 與單程效率不可跨口徑比'],
 ['Beacon／場站資產方','20 MW 調頻','既有場站商轉；原公司資產分拆','備件、軟體、保固與簽約主體'],
 ['Stornetic','分鐘級高功率','DuraStor 商業模組','動能／有效能量與全年輔機'],
 ['Amber Kinetics','4 h 長時鋼轉子','小規模商業部署','DC RTE、利用率與多場站實績'],
 ['Torus／Revterra／QuinteQ','混合、磁浮新創','早期商業化','待機與規格需第三方驗證'],
 ['Energiestro','混凝土＋玻纖','beta／試量產','材料老化、一致性與圍堵'],
 ['中國供應商群','大功率調頻／UPS','工程化加速','以場站性能與服務驗證']
 ],[.23,.20,.28,.29],fs=10.7),
 text('ownership',44,454,872,30,'公司終止不等於資產消失；工商存續也不等於財務健全或產品通過驗收。',12.5,'$copper',True)]
add(16,'全球廠商地圖',e)

# 17 Product comparison
e=base('產品規格差異來自應用邊界，不宜用單一效率或 kWh 排名','代表產品',17,'來源：各廠商官方資料表。放電時間為額定點或公開功率／能量核算；UPS 隨負載變化。')
e += [table('products',44,120,872,344,['產品','功率','能量（原口徑）','時間','效率／成熟度判讀'],[
 ['Beacon Gen4','100 kW','25 kWh','約 15 min','既有電站商轉；製造主體低度營運'],
 ['Amber M32','8 kW','32 kWh','4 h','DC RTE >86%；小規模商業部署'],
 ['Active Power PLUS MMS','300–2,400 kW','6.2 MJ／模組','最長約 2 min','UPS 效率口徑；定期軸承維護'],
 ['VYCON VDC XXE','300 kW+','6,000 kW·s','秒級','直流母排 UPS；非 AC 往返效率'],
 ['DuraStor 240','240 kW','動能 16；有效 9.2 kWh','120 s','典型 RTE 80%（含輔機）'],
 ['DuraStor 1000','1,000 kW','動能 64；有效 37 kWh','122 s','典型 RTE >82%（含輔機）'],
 ['Revterra S100','400 kW','100 kWh','約 15 min','早期商業；約 50 W 待機為開發方口徑'],
 ['Energiestro VOSS','約 10 kW','10 kWh','約 1 h','beta／試量產，非成熟量產品']
 ],[.23,.15,.22,.12,.28],fs=10.3),
 text('prod-note',44,474,872,18,'完整 14 項產品、設計壽命與限制見 Word 報告第 7 章。',10.5,'$muted')]
add(17,'產品比較',e)

# 18 Stornetic
e=base('DuraStor 的規格頁，示範了「動能」與「有效能量」應分列','產品案例｜Stornetic',18,'來源：Stornetic DuraStor／EnWheel 官方產品頁；規格為廠商口徑，典型 RTE 標示含輔機。')
e += [image('durastor',44,130,420,250,'durastor.png','contain'),text('cap',44,384,420,24,'DuraStor 商業模組｜圖：Stornetic',9.5,'$muted',align='center'),
 table('stornetic',504,130,412,152,['型號','240','1000'],[
 ['額定功率','240 kW','1,000 kW'],['總動能','16 kWh','64 kWh'],['有效能量','9.2 kWh','37 kWh'],['額定放電','120 s','122 s'],['典型 RTE','80%','>82%']
 ],[.40,.30,.30],fs=11),
 text('stornetic-take',504,312,412,88,'有效能量約為總動能的 57–58%。\n若只拿 16／64 kWh 和其他產品的有效能量比，會高估可交付能力。',14,'$copper',True,lh=1.35),
 text('stornetic-foot',44,444,872,34,'仍需向供應商索取全年站用電、部分負載效率、真空與冷卻維護，以及既有場站可用率。',12)]
add(18,'Stornetic 產品案例',e)

# 19 UPS
e=base('UPS 飛輪的核心是橋接與電能品質，不是長時能量搬移','產品案例｜UPS',19,'來源：Active Power CleanSource PLUS MMS、Piller POWERBRIDGE、VYCON VDC 官方資料；廠商規格。')
e += [image('active',44,130,356,224,'active_power.png','contain'),text('cap',44,360,356,24,'Active Power UPS 方案｜圖：官方資料',9.5,'$muted',align='center'),
 table('ups',436,130,480,190,['方案','公開規格','正確解讀'],[
 ['Active Power PLUS MMS','300–2,400 kW；6.2 MJ／模組','效率是 UPS 邊界；依負載核算 ride-through'],
 ['Piller POWERBRIDGE','3.6–60+ MJ；最高 MW 級','低速重型關鍵電力；與發電機／靜態開關整合'],
 ['VYCON VDC XXE','300 kW+；6,000 kW·s','直流母排儲能；單程效率非 AC RTE']
 ],[.28,.31,.41],fs=10.7),
 text('ups-check',436,346,480,104,'驗收五項\n負載階躍｜切換與旁路｜發電機啟動銜接｜故障穿越｜軸承與備件維護',13,'$primary',True,lh=1.35),
 text('ups-bottom',44,458,872,24,'AI 資料中心帶來新需求，但 2026 中壓 SST＋飛輪 UPS 仍需實際負載與故障測試。',11.5,'$copper',True)]
add(19,'UPS 產品',e)

# 20 Long duration
e=base('長時純飛輪有技術差異化，但商業證據強度不一','長時與新創',20,'來源：Amber M32 官方資料表；Revterra／Greentown Labs；Energiestro 技術報導；QuinteQ 公司資料。')
e += [image('amber',44,130,330,216,'amber.png','contain'),text('cap',44,352,330,24,'Amber Kinetics 長時飛輪｜圖：公開專題資料',9.5,'$muted',align='center'),
 table('long',410,130,506,224,['路線','公開定位','成熟判斷','待驗證'],[
 ['Amber M32','8 kW／32 kWh；4 h','小規模商業','多場站利用率、DC／AC 邊界與待機'],
 ['Revterra S100','400 kW／100 kWh','早期商業','約 50 W 待機、超導穩定與服務體系'],
 ['Energiestro VOSS','約 10 kW／10 kWh','beta／試量產','混凝土老化、製造一致性與圍堵'],
 ['QuinteQ','100 kW／5 kWh','初期商業','低溫冷卻、待機與長期運維']
 ],[.24,.25,.20,.31],fs=10.7),
 text('long-take',44,406,872,58,'採購門檻：至少兩個獨立場站、可核查全年性能、完整維護工單與同邊界長時技術比較。\n技術可行、第三方測試、量產能力與運轉年數必須分開評分。',12.5,'$copper',True,lh=1.35)]
add(20,'長時與新創產品',e)

# 21 China companies
e=base('中國工程化加速，但工商資料不能代替履約與產品驗收','中國企業',21,'來源：天眼查工商查詢（2026-10-30）；註冊資本為登記資料，風險標籤需另做信用與法律核查。')
e += [table('china',44,120,872,344,['企業','註冊資本','成立','技術定位／風險提示'],[
 ['瀋陽微控','17,000 萬人民幣','2018','電網調頻、UPS、磁軸承；上市輔導標籤'],
 ['北京泓慧','3,500.17 萬人民幣','2015','磁懸浮飛輪、關鍵電力；上市輔導標籤'],
 ['坎德拉','1,270.43 萬人民幣','2018','高倍率一次調頻、陣列與混合儲能'],
 ['華馳動能','1,967.95 萬人民幣','2019','大功率全磁懸浮；單機規格需逐案驗收'],
 ['貝肯新能源','6,591.29 萬人民幣','2017','Temporal 技術傳承；鼎輪 30 MW 方案'],
 ['奇峰聚能','8,571.43 萬人民幣','2009','分佈式飛輪網路；另做信用風險核查'],
 ['羅特尼克','1,416.66 萬美元','2012','高速複材；含破產案件風險標籤'],
 ['博鼎儲能','5,000 萬人民幣','2021','磁軸承與系統；公開證據較少']
 ],[.22,.20,.11,.47],fs=10.5),
 text('china-note',44,474,872,18,'評估順序：同任務場站 → 全年性能與工單 → 服務與備件 → 財務與法律風險。',10.8,'$copper',True)]
add(21,'中國企業',e)

# 22 Global projects
e=base('商業場站證明陣列可行，示範專案則只支持整合可行性','全球專案證據',22,'來源：美國 DOE、長治市政府、Leclanché／S4、EU CORDIS、Natural Resources Canada。')
e += [image('project-img',560,126,356,196,'dinglun.png'),text('cap',560,326,356,24,'鼎輪 30 MW 專案｜併網證據不等同全年性能',9.5,'$muted',align='center'),
 table('projects',44,126,480,250,['專案','規模／架構','證據層級'],[
 ['Stephentown／Hazle','20 MW／站；純飛輪','商業運轉'],
 ['鼎輪長治','30 MW；120 台','2024 併網'],
 ['Almelo／Heerhugowaard','約 10 MW 級；飛輪＋鋰電','商業運轉'],
 ['Schwungrad／EirGrid','早期 160 kW 級；混合','示範'],
 ['Raglan','風＋200 kW 飛輪＋氫＋電池','2014–2019 示範']
 ],[.36,.42,.22],fs=10.7),
 text('project-take',44,404,872,62,'場站證據要拆成：併網 → 調試 → 性能驗收 → 正式商轉 → 市場結算。\n公司或技術供應商狀態改變，不代表既有資產停止運轉。',13,'$copper',True,lh=1.35)]
add(22,'全球專案',e)

# 23 China timeline
e=base('中國專案由混合示範走向大陣列，里程碑用詞必須精確','中國專案時間線',23,'來源：CNESA（朔州）、長治市政府（鼎輪）、公開專案報導（文水、綿陽）；截至 2026-10-30。')
e += [rule('timeline',76,250,808,'$primary',3)]
events=[(100,'2022','朔州熱電','5 MW/5 MWh LFP\n＋2 MW/0.4 MWh 飛輪','示範投運'),(326,'2024','鼎輪長治','30 MW／120 台\n純飛輪獨立調頻','全容量併網'),(576,'2026.04','文水','200 MW/100.83 MWh\n400 台飛輪＋LFP','全容量併網'),(826,'2026','綿陽港旗一期','100 MW/200 MWh\n＋15 MW/0.525 MWh','商轉報導')]
for i,(x,yr,t,b,st) in enumerate(events):
 e += [rect(f'dot{i}',x-6,244,12,12,'$copper'),text(f'yr{i}',x-52,178,104,26,yr,17,'$copper',True,align='center'),text(f't{i}',x-80,286,160,26,t,13,'$primary',True,align='center'),text(f'b{i}',x-88,318,176,54,b,10.8,align='center'),text(f'st{i}',x-76,384,152,24,st,11,'$muted',True,align='center')]
e += [text('timeline-note',44,446,872,36,'併網、後續調試、一次調頻測試、性能驗收與正式商轉是不同證據；不能一律寫成「投運」。',12.5,'$copper',True,align='center')]
add(23,'中國專案時間線',e)

# 24 Maturity
e=base('應用成熟度由商業證據決定，不由技術吸引力決定','應用成熟度',24,'來源：本報告依產品與專案證據整理；成熟度為定性判斷，不代表市場規模。')
e += [image('maturity',44,126,548,306,'maturity.png','contain'),
 table('app',624,126,292,250,['應用','2026 判斷'],[
 ['UPS／關鍵電力','成熟商業'],['電網調頻','已有商業場站'],['工業電能品質','商業／項目型'],['飛輪＋鋰電','多國商業部署'],['小時級純飛輪','早期商業／利基'],['飛輪＋氫能','示範／模擬為主']
 ],[.58,.42],fs=10.7),
 text('maturity-note',44,452,872,30,'氫能混合的研究價值高，但目前不能與 UPS 或調頻使用同一成熟度敘事。',12.5,'$copper',True)]
add(24,'應用成熟度',e)

# 25 Hybrid architecture
e=base('飛輪吃高頻微循環，鋰電保留小時級能量與 SOC 裕度','飛輪＋鋰電',25,'來源：Wang 2024；Barelli 2019；Han 2026。左圖為架構整理，右圖為合成訊號，非專案實測。')
node(e,'renew',44,142,150,72,'電網／再生能源','高頻＋低頻功率指令',True)
node(e,'split',260,142,150,72,'混合 EMS','頻譜分解＋SOC 約束')
node(e,'fly',486,122,150,64,'飛輪','高頻、秒至分鐘')
node(e,'bat',486,210,150,64,'鋰電','低頻、小時級能量')
node(e,'output',712,142,160,72,'併網點','完成調度＋電能品質',True)
e += [arrow('ha1',194,178,66),arrow('ha2',410,158,76),arrow('ha3',410,220,76),arrow('ha4',636,158,76),arrow('ha5',636,220,76),
 image('hybrid',44,310,560,158,'hybrid_split.png','contain'),
 text('hybrid-note',640,318,276,132,'控制由簡到繁\n固定濾波 → SOC 約束 → MPC → 衰退導向\n\n飛輪 SOC 必須恢復，否則高頻吸收能力會逐漸耗盡。',11.5,'$text',lh=1.3)]
add(25,'鋰電混合架構',e)

# 26 Hybrid evidence
e=base('混合系統的價值要用電池衰退與整站效率共同驗收','鋰電專案與控制',26,'來源：CNESA、Leclanché／S4、綿陽與文水專案資料；壽命改善為專案方或研究口徑，不能外推固定倍率。')
e += [table('hybrid-projects',44,124,872,188,['專案','架構','證據','決策解讀'],[
 ['朔州熱電','5 MW/5 MWh LFP＋2 MW/0.4 MWh 飛輪','早期示範投運','證明火儲聯合調頻整合可行'],
 ['Almelo／Heerhugowaard','飛輪＋鋰電 FCR','荷蘭商業運轉','支持混合商業模式；壽命仍看基準'],
 ['綿陽港旗一期','100 MW/200 MWh＋15 MW/0.525 MWh','2026 商轉報導','大型混合獨立儲能案例'],
 ['文水','400 台 125 kW 飛輪＋LFP','2026 全容量併網','併網後性能與正式投運分開追蹤']
 ],[.23,.33,.19,.25],fs=10.8),
 text('ab-title',44,340,300,24,'同場 A/B 的最小資料集',15,'$primary',True),
 text('ab',44,376,520,88,'純鋰電基準｜等效完整循環｜最大／平均 C-rate\nSOC 擺幅｜溫度｜容量與內阻衰退｜混合 RTE\n調頻性能｜站用電｜飛輪維護與備件',12.2,lh=1.4),
 vrule('abv',596,344,116),text('ab-take',624,344,292,116,'只展示功率分流圖，無法證明電池壽命或經濟收益。\n\n驗收與付款應綁定原始數據交付。',12.5,'$copper',True,lh=1.35)]
add(26,'鋰電專案與控制',e)

# 27 Hydrogen
e=base('飛輪可支撐電解槽電功率，但不能解決氫儲能的低效率','飛輪＋氫能',27,'來源：Raglan、Utsira、Elkholy 2024、Baldinelli 2019、Popova 2025；示範與模擬分層。')
node(e,'wind',44,142,146,72,'風光輸入','快速波動＋長時不平衡',True)
node(e,'dc',256,142,146,72,'直流母排／EMS','電壓、爬坡與故障控制')
node(e,'flyh',468,118,146,64,'飛輪','次秒平滑／故障支撐')
node(e,'electro',468,214,146,64,'電解槽','最小負載／爬坡／熱待機')
node(e,'hydrogen',680,214,192,64,'儲氫＋燃料電池','長時能量／季節性',True)
e += [arrow('h1',190,178,66),arrow('h2',402,154,66),arrow('h3',402,220,66),arrow('h4',614,246,66),
 table('hydrogen-evidence',44,320,872,134,['證據','性質','支持的結論','不能外推'],[
 ['Raglan','微電網示範','200 kW 飛輪與風氫電池整合','大型電解槽專用商品化'],
 ['Elkholy 2024','最佳化模擬','模型中燃料電池 100→30 kW','實測電站效率或通用比例'],
 ['Popova 2025','故障恢復研究','大型電解槽需要儲能支撐','已完成保護與併網實測']
 ],[.20,.20,.32,.28],fs=10.5),
 text('hydrogen-note',44,468,872,18,'驗收：真實電解槽動態、壓縮／純化輔機、氫安全、飛輪 SOC 恢復與連續運轉。',10.5,'$copper',True)]
add(27,'氫能架構與證據',e)

# 28 Standards
e=base('標準解決測試邊界，採購還要把待機與故障注入寫進驗收','標準與採購',28,'來源：GB/T 44933、44934、46372；IEC 62933、IEEE 1547、UL 9540、UL 1778。適用性依產品邊界與司法管轄區。')
e += [table('standards',44,122,872,148,['標準','時間','用途'],[
 ['GB/T 44933-2024｜系統技術規範','2025-07-01 實施','200 kW 及以上交流併網系統'],
 ['GB/T 44934-2024｜儲能單元技術規範','2025-07-01 實施','飛輪儲能單元設計、性能與試驗'],
 ['GB/T 46372-2025｜電站調試導則','2026-05-01 實施','併網、調試與驗收程序']
 ],[.44,.22,.34],fs=11),
 text('procure-title',44,296,300,24,'技術規格書的最小資料集',15,'$primary',True),
 text('procure',44,330,496,128,'① 有效能量、持續／短時功率、轉速窗口\n② AC／DC 效率邊界、輔機清單、待機 kW\n③ 24／72 h 能量保持與四季站用電\n④ 超速、圍堵、備援軸承、真空與熱\n⑤ AGC／一次調頻、無功、故障穿越\n⑥ 可用率、維護、備件、軟體與資料所有權',11.7,lh=1.35),
 vrule('pv',572,300,154),text('standard-note',600,300,316,154,'UL 9540 的電池熱失控要求，不能直接當成飛輪完整安全證明。\n\n飛輪仍需機械超速、圍堵、真空與軸承失效評估。',12.2,'$copper',True,lh=1.35)]
add(28,'標準與採購',e)

# 29 Scenarios
e=base('未來五年的基準情境是混合化與場景深化，不是全面取代鋰電','2027–2031 情境',29,'來源：本報告情境分析；屬前瞻假設，不是市場承諾。未採用未核實單一 CAGR 作為核心結論。')
e += [table('scenarios',44,126,872,236,['情境','可能演變','觸發條件','觀察指標'],[
 ['保守','UPS 穩定；調頻區域型；長時與氫耦合慢','收益不足、待機高、可靠度與融資證據少','新場站少、備件問題、收益依賴單一政策'],
 ['基準','UPS／調頻／鋰電混合增長；長時少量複製','標準落地、A/B 增加、站用電下降','全年性能、商轉驗收、電池衰退與 SLA'],
 ['樂觀','低待機、新材料、構網與資料中心規模化','全尺寸安全、多年運轉、成本下降','長時多次複製、大型氫項目連續運轉']
 ],[.13,.36,.27,.24],fs=11.3),
 text('watch',44,392,872,70,'真正的突破判準\n同安全裕度下更高有效能量｜更低待機｜可量產一致性｜可維護性｜第三方全年數據',14,'$copper',True,align='center',lh=1.4)]
add(29,'五年情境',e)

# 30 Roadmap
e=base('每年都要用可觀察證據，決定是否進入下一階段投資','實施路線圖',30,'來源：本報告 2027–2031 觀察路線；屬前瞻假設與決策門檻，不是確定時程承諾。')
e += [table('roadmap',44,124,872,270,['期間','技術焦點','產業焦點','決策節點'],[
 ['2027','低功耗磁軸承、陣列健康分配','大型專案轉向性能與收益驗證','全年可用率、站用電與工單是否公開'],
 ['2028','衰退導向混合、構網與故障穿越','UPS 與混合參考設計增加','中壓 UPS／構網第三方故障測試'],
 ['2029','複材老化、圍堵與長時成本優化','長時純飛輪可複製或維持利基','兩個以上獨立場站同性能'],
 ['2030','多資產 EMS、飛輪－電池－氫協調','氫耦合由微電網走向較大示範','真實電解槽與氫安全邊界驗收'],
 ['2031','全生命週期健康與可維修設計','服務、性能保固與供應商整併','融資是否接受標準化長期數據']
 ],[.12,.30,.29,.29],fs=11),
 text('gate',44,424,872,40,'投資門檻：先取得任務譜與同口徑資料，再進入場站核查、性能保固與全生命週期比較。',13,'$copper',True,align='center')]
add(30,'實施路線圖',e)

# 31 Sources
e=base('主要來源以 DOI、官方產品頁、政府專案與標準為主','主要來源',31,'來源：完整 86 項來源與超連結見 Word 報告附錄 B；本頁列出簡報核心證據。')
e += [text('sources-left',44,122,420,342,'<p><strong>學術</strong></p><p>Bolund et al. 2007｜10.1016/j.rser.2005.01.004</p><p>Amiryar & Pullen 2017｜10.3390/app7030286</p><p>Hu et al. 2023｜S2352152X2302474X</p><p>Takarli et al. 2023｜IEEE 10203021</p><p>Venturini et al. 2024｜10.1016/j.energy.2024.132641</p><p>Liu et al. 2026｜10.1063/5.0320285</p><p>Hashim et al. 2026｜10.1038/s41598-026-66926-y</p><p>Han et al. 2026｜10.1002/ese3.70656</p><p>Elkholy et al. 2024｜10.1016/j.est.2024.113771</p><p><strong>企業與專利</strong></p><p>天眼查工商／專利快照｜2026-10-30</p><p>Justia Patents｜Amber、Beacon 專利清單</p>',10.2,'$text',lh=1.28),
 vrule('sv',488,126,332),text('sources-right',516,122,400,342,'<p><strong>產品</strong></p><p>Stornetic｜DuraStor／EnWheel 官方規格</p><p>Active Power｜CleanSource PLUS MMS 資料表</p><p>Piller｜POWERBRIDGE 官方產品頁</p><p>VYCON／Calnetix｜VDC 系列資料</p><p>Amber Kinetics｜M32 官方資料表</p><p><strong>專案與標準</strong></p><p>美國 DOE｜Hazle 20 MW、Amber 示範</p><p>長治市政府｜鼎輪 30 MW 併網</p><p>CNESA｜朔州鋰電－飛輪混合</p><p>Leclanché／S4｜荷蘭混合專案</p><p>NRCan｜Raglan 微電網示範</p><p>GB/T 44933、44934、46372</p><p>IEC 62933｜IEEE 1547｜UL 9540／1778</p>',10.2,'$text',lh=1.28),
 text('sources-note',44,474,872,18,'所有產品效率、壽命與待機規格均保留廠商口徑；引用不代表第三方驗證。',10.5,'$copper',True)]
add(31,'主要來源',e)

# 32 Conclusion
e=base('從任務譜出發，把性能、風險與原始數據交付寫進決策','決策結論',32,'來源：本報告綜合判斷；完整 90 天盡調流程與供應商資料清單見 Word 報告第 14 章及附錄 A。')
e += [text('final-lead',44,122,872,42,'先決定需要多少功率、能量與循環，再選擇純飛輪、飛輪－鋰電或飛輪－氫能。',17,'$primary',True),
 table('final',44,184,872,204,['目標','優先方案','不可省略的驗收'],[
 ['關鍵電力','成熟 UPS 整機與服務','負載階躍、旁路、發電機銜接、維護'],
 ['高頻調頻','純飛輪或飛輪－鋰電','市場訊號、SOC 恢復、待機與可用率'],
 ['降低鋰電衰退','混合系統＋同場 A/B','吞吐、C-rate、溫度、容量／內阻與混合 RTE'],
 ['風光制氫','飛輪平滑＋氫長時','真實電解槽動態、氫安全與連續運轉'],
 ['4 h 以上能量搬移','與其他長時技術同邊界比較','多場站、多年、第三方性能與維護資料']
 ],[.23,.32,.45],fs=11.5),
 text('final-action',44,420,872,44,'下一步：用同一份供應商資料模板收齊有效能量、含輔機效率、待機、圍堵、維護與場站原始數據，再進入技術與商務評分。',13,'$copper',True,align='center',lh=1.35)]
add(32,'決策結論',e,'final')

main={'version':'v2','title':'飛輪儲能技術全景簡報','size':[960,540],
 'customFonts':[{'family':'MiSans','src':'https://statics.kimi.ai/neo-design-static/p-font/MiSans.ttf'}],
 'theme':{'colors':C,'textStyles':{'body':{'fontSize':14,'color':'$text','fontFamily':'MiSans','lineHeight':1.22}},
 'tableStyles':{'default':{'cellStyle':{'fontFamily':'MiSans','fontSize':11.5,'color':'$text','border':[{'style':'solid','width':0.6,'color':'$line'},None,{'style':'solid','width':0.6,'color':'$line'},None],'align':['left','middle']},'firstRowStyle':{'fill':{'type':'solid','color':'$dark'},'color':'#FFFFFF','bold':True},'bodyStyles':[{'fill':{'type':'solid','color':'#FFFFFF'}},{'fill':{'type':'solid','color':'$pale'}}],'rowOverColumn':True}}},
 'pages':pages}
with open(ROOT/'飛輪儲能技術全景簡報.pptd','w',encoding='utf-8') as f: yaml.safe_dump(main,f,allow_unicode=True,sort_keys=False,width=1000)
print(f'Wrote {len(pages)} pages to {ROOT}')
