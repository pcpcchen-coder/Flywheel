from pathlib import Path
import yaml, shutil

ROOT=Path(__file__).resolve().parents[1] / 'slides'
PAGES=ROOT/'pages'
PAGES.mkdir(parents=True,exist_ok=True)
W,H=960,540
C={'paper':'#F7F4ED','ink':'#22302E','teal':'#183F3B','teal2':'#245C57','copper':'#B65D38','gray':'#6B756F','line':'#D8D2C5','pale':'#E7ECE7','white':'#FFFFFF','soft':'#EEE8DC'}
U={
'raiba':'https://www.usenix.org/conference/atc18/presentation/chiueh',
'itri':'https://www.itri.org.tw/ListStyle.aspx?DisplayStyle=13_content&SiteID=1&MmmID=1036233405427625204&Trt_idx=6074',
'hu':'https://doi.org/10.1109/IFEEC.2013.6687490',
'kersten':'https://doi.org/10.1109/IECON43393.2020.9254515',
'chen':'https://doi.org/10.1109/TTE.2024.3350878',
'peng':'https://doi.org/10.1109/TPEL.2025.3600334',
'paiz':'https://arxiv.org/abs/2603.21651',
'wen':'https://doi.org/10.3390/en18082055',
'doe':'https://www.energy.gov/sites/prod/files/2017/01/f34/02%2005%202016%20-%20Final%20TPR_Hazle%20Spindle%20LLC.pdf',
'amber':'https://www.amberkinetics.com/wp-content/uploads/2020/05/Amber-Kinetics-DataSheet.pdf',
's4':'https://www.leclanche.com/leclanche-and-s4-energy-complete-hybrid-energy-storage-project-to-serve-dutch-frequency-containment-reserve-market/',
'drbn':'https://www.eea.tsinghua.edu.cn/info/1038/6726.htm',
'ruicheng':'https://www.shanxi.gov.cn/zfxxgk/zfxxgkzl/fdzdgknr/zdxm/202507/t20250725_9924573.shtml',
'delta':'https://www.prnasia.com/story/529703-1.shtml',
'github':'https://github.com/pcpcchen-coder/RAIBA',
}

def fill(color): return {'type':'solid','color':color}
def text(eid,b,txt,size=18,color='$ink',bold=False,align=('left','top'),lh=1.2,wrap=True,font=None):
    c={'text':txt,'fontSize':size,'color':color,'bold':bold,'align':list(align),'lineHeight':lh,'wrap':wrap}
    if font: c['fontFamily']=font
    return {'elementId':eid,'elementType':'text','bounds':b,'content':c}
def rect(eid,b,color,border=None):
    d={'elementId':eid,'elementType':'shape','bounds':b,'shapeName':'rect','fill':fill(color)}
    if border: d['border']=border
    return d
def line(eid,b,color='$line',width=1,arrow=None,points=None):
    d={'elementId':eid,'elementType':'line','bounds':b,'viewBox':[100,100],'points':points or '0,50 100,50','curve':'sharp','border':{'style':'solid','width':width,'color':color}}
    if arrow: d['arrow']=arrow
    return d
def image(eid,b,src,mode='cover'):
    return {'elementId':eid,'elementType':'image','bounds':b,'src':src,'fit':{'mode':mode}}
def table(eid,b,headers,rows,widths=None,fs=13,rowHeights=None):
    n=len(headers); widths=widths or [1/n]*n
    data=[[{'text':h,'bold':True,'color':'$white','fill':fill('$teal'),'fontSize':fs,'align':['left','middle']} for h in headers]]
    for i,r in enumerate(rows):
        data.append([{'text':str(v),'fontSize':fs,'color':'$ink','fill':fill('$paper' if i%2 else '$white'),'align':['left','middle'],'lineHeight':1.15} for v in r])
    rh=rowHeights or [0.14]+[(0.86)/len(rows)]*len(rows)
    return {'elementId':eid,'elementType':'table','bounds':b,'columnWidths':widths,'rowHeights':rh,'rows':data,
            'style':{'cellStyle':{'border':{'style':'solid','width':0.6,'color':'$line'},'fontFamily':{'latin':'Liter','ea':'MiSans'}}}}
def src(eid,label,url,y=482):
    return text(eid,[60,y,840,20],f'資料來源｜<a href="{url}">{label}</a>',9,'$gray',lh=1.0)
def src_multi(eid,pairs,y=482):
    links='；'.join(f'<a href="{url}">{label}</a>' for label,url in pairs)
    return text(eid,[60,y,840,20],'資料來源｜'+links,9,'$gray',lh=1.0)
def base(num,title,section,subtitle=None,bg='$paper'):
    els=[text('section',[60,18,700,18],section,10,'$copper',True,lh=1.0),
         text('title',[60,43,840,45],title,28,'$teal',True,lh=1.05),
         rect('title-rule',[60,99,64,4],'$copper'),
         line('footer-rule',[60,508,840,2],'$line',0.8),
         text('footer-left',[60,516,420,14],'FESS × RAIBA｜研發立項審查',9,'$gray',lh=1.0),
         text('footer-page',[820,516,80,14],f'{num:02d} / 24',9,'$gray',align=('right','top'),lh=1.0)]
    if subtitle: els.insert(2,text('subtitle',[60,108,840,24],subtitle,13,'$gray',lh=1.1))
    return {'pageType':'content','background':fill(bg),'elements':els}
def add(num,name,page):
    fn=f'{num:02d}_{name}.page'
    with open(PAGES/fn,'w',encoding='utf-8') as f: yaml.safe_dump(page,f,allow_unicode=True,sort_keys=False,width=160)
    return f'pages/{fn}'
def bullet_lines(items): return '\n'.join('• '+x for x in items)

files=[]
# 01 Cover
p={'pageType':'cover','background':fill('$paper'),'elements':[
 rect('spine',[0,0,18,540],'$copper'),
 image('cover-img',[625,0,335,540],'media/8_Enel_will_put_Amber_Kinetics_long.png','cover'),
 rect('image-caption-bg',[625,458,335,82],'$teal'),
 text('image-caption',[645,474,295,48],'長時飛輪代表產品｜Amber Kinetics\n圖像僅作產業案例辨識',11,'$white',lh=1.25),
 text('kicker',[60,58,500,24],'研發立項完整簡報｜V1.0',13,'$copper',True),
 text('title',[60,112,520,116],'飛輪儲能 × RAIBA',44,'$teal',True,lh=1.1),
 text('title2',[60,226,520,88],'可重構電池系統\n技術研發議題',32,'$ink',True,lh=1.2),
 line('cover-rule',[60,338,500,2],'$copper',3),
 text('subtitle',[60,362,520,58],'重構暫態穩定｜故障功率橋接\n服務不間斷診斷｜全壽命最佳化',18,'$gray',lh=1.35),
 text('date',[60,476,500,20],'資料檢索截止 2026.11.23｜立項審查用',11,'$gray') ]}
files.append(add(1,'cover',p))

# 02 Decision
p=base(2,'建議有條件通過 12 個月 MVP，不直接核准 MW 全功能系統','DECISION SUMMARY')
e=p['elements']
e += [text('decision',[60,145,290,92],'有條件通過',36,'$copper',True,lh=1.1),
      text('decision-sub',[60,242,275,96],'先證明對照可信、暫態安全與診斷有效，再談效率、延壽與放大。',19,'$ink',lh=1.4),
      line('decision-axis',[375,142,2,290],'$copper',3,points='50,0 50,100'),
      text('d1',[410,140,480,58],'<p><strong>主攻架構 B</strong>｜共 DC-link＋選擇性雙向 DC/DC＋RAIBA</p>',18,'$ink',lh=1.25),
      text('d2',[410,205,480,58],'<p><strong>架構 A 保底</strong>｜固定 DC-link／AC 耦合，先完成診斷與故障實證</p>',18,'$ink',lh=1.25),
      text('d3',[410,270,480,58],'<p><strong>B2 可停止</strong>｜可變 DC-link 直接耦合，不列 12 個月必成</p>',18,'$ink',lh=1.25),
      text('d4',[410,335,480,76],'<p><strong>三條主軸</strong>｜重構暫態、故障功率橋接、EIS／SOH 驅動重構</p>',18,'$ink',lh=1.25),
      rect('bottom-band',[60,446,840,28],'$teal'),
      text('bottom-text',[76,451,805,18],'四組對照 B0–B3 與暫態／EIS 雙 Gate 是核准前提；KPI 全部是待驗證目標。',13,'$white',True,lh=1.0)]
files.append(add(2,'decision',p))

# 03 Why beyond power split
p=base(3,'傳統功率分流只回答「誰出功率」，沒有回答「重構時是否安全」','01｜PROBLEM')
e=p['elements']
e += [text('left-title',[60,145,350,28],'既有 HESS 的成熟主線',20,'$teal',True),
      text('left-body',[60,188,350,150],bullet_lines(['高頻給飛輪、低頻給電池','飛輪 SOC 自恢復','容量最佳化與調頻控制','以效率、波動率或延壽評估']),18,'$ink',lh=1.6),
      line('split',[445,142,2,280],'$line',1.2,points='50,0 50,100'),
      text('right-title',[485,145,415,28],'本計畫必須新增的四個問題',20,'$copper',True),
      text('right-body',[485,188,415,190],bullet_lines(['拓撲切換時，母線缺口與湧流多大？','模組故障後，飛輪能橋接多久？','EIS 量測是否仍維持對外服務？','診斷結果如何即時改變拓撲？']),18,'$ink',lh=1.55),
      rect('conclusion',[60,412,840,52],'$pale'),
      text('conclusion-text',[80,425,800,26],'研究價值＝時間域功率掩護 × 空間域模組重構，而非再做一次功率分配模擬。',18,'$teal',True,lh=1.1)]
files.append(add(3,'problem',p))

# 04 Complementarity
p=base(4,'飛輪管時間域、RAIBA 管空間域；健康度與保護負責耦合','01｜SYSTEM CONCEPT')
e=p['elements']
e += [text('time-label',[60,142,350,30],'時間域｜飛輪功率掩護',21,'$teal',True),
      line('time-axis',[80,207,310,4],'$teal',4,arrow=[None,'stealth']),
      text('time-events',[65,228,340,76],'ms　　重構／故障　　　秒級橋接\n快速雙向功率｜高循環｜能量有限',16,'$gray',lh=1.45),
      text('space-label',[540,142,360,30],'空間域｜RAIBA 模組路由',21,'$copper',True),
      text('space-body',[540,190,350,126],bullet_lines(['模組串併聯與旁路','故障隔離與降額拓撲','依 SOH／溫度輪替模組','提供診斷激勵與工作點自由度']),17,'$ink',lh=1.45),
      line('bridge',[395,182,140,60],'$copper',2.4,arrow=[None,'stealth'],points='0,80 100,20'),
      text('bridge-label',[385,252,160,44],'功率前饋\n拓撲回授',14,'$copper',True,align=('center','top'),lh=1.25),
      rect('shared',[160,354,640,82],'$teal'),
      text('shared-text',[185,370,590,48],'共享狀態：功率需求｜飛輪可用能量｜模組 V/I/T/EIS/SOH｜保護與組態白名單',18,'$white',True,align=('center','middle'),lh=1.25),
      src_multi('src',[('RAIBA｜USENIX ATC 2018',U['raiba']),('工研院技轉資料',U['itri'])])]
files.append(add(4,'complementarity',p))

# 05 Evidence classes
p=base(5,'先分證據層級，才能避免把模擬、企業宣稱與立項目標寫成實績','02｜EVIDENCE')
e=p['elements']
e += [table('evidence-table',[60,137,840,220],['證據類型','本簡報如何使用'],[
      ['論文－實測','只適用於原型、負載與測試條件'],['論文－模擬','不得視為工程實績或通用性能'],['工程事實','作為成熟度與 benchmark，仍看量測邊界'],['企業宣稱','需第三方或原始測試確認'],['立項建議','KPI、Gate 與架構全部待驗證']],[0.25,0.75],13),
      text('redline-title',[60,385,180,26],'查新紅線',19,'$copper',True),
      text('redlines',[250,380,650,74],'不得宣稱「全球首次飛輪＋可重構電池」\n不得宣稱「首次 RBS 無額外電源做 EIS」',18,'$ink',True,lh=1.5),
      src('src','證據邊界與完整引用見 Word 報告第一、三章',U['github'])]
files.append(add(5,'evidence',p))

# 06 Literature timeline
p=base(6,'直接前案已覆蓋共 DC、RBS-EIS 與 FESS＋DRBN 調度','02｜PRIOR ART')
e=p['elements']
e += [line('timeline',[85,260,790,4],'$teal',3),
      *[rect(f'dot{i}',[x,251,18,18],'$copper' if yr in ('2020','2026') else '$teal') for i,(x,yr) in enumerate([(95,'2013'),(255,'2016'),(400,'2020'),(535,'2024'),(675,'2026'),(810,'2026')])],
      text('y2013',[60,175,120,56],'2013\n共 DC-bus 實測',16,'$teal',True,align=('center','top'),lh=1.25),
      text('y2016',[215,295,130,64],'2016\nRBS 系統綜述',16,'$teal',True,align=('center','top'),lh=1.25),
      text('y2020',[350,165,145,72],'2020\nRBS 線上阻抗估計',16,'$copper',True,align=('center','top'),lh=1.25),
      text('y2024',[500,295,130,64],'2024\n16 芯 MSPWM EIS',16,'$teal',True,align=('center','top'),lh=1.25),
      text('y2026a',[625,155,145,82],'2026\n切換暫態萃取阻抗',16,'$copper',True,align=('center','top'),lh=1.25),
      text('y2026b',[765,295,150,76],'2026\nFESS＋DRBN 階層 MPC',16,'$copper',True,align=('center','top'),lh=1.25),
      rect('gap',[120,399,720,48],'$pale'),
      text('gap-text',[140,411,680,26],'剩余缺口：開關暫態＋故障橋接＋服務不間斷 EIS＋診斷回授的完整實驗閉環',17,'$teal',True,align=('center','middle')),
      src_multi('src',[('Hu 2013',U['hu']),('Kersten 2020',U['kersten']),('Chen 2024',U['chen']),('Peng 2026',U['peng']),('Paizulamu 2026',U['paiz'])])]
files.append(add(6,'timeline',p))

# 07 Direct FESS+DRBN prior
p=base(7,'FESS＋DRBN 已有直接前案：新穎性必須降到開關與量測層','02｜DIRECT PRIOR ART')
e=p['elements']
e += [text('paper',[60,137,490,54],'Paizulamu et al.｜Full Timescale Hierarchical MPC-MTIP',19,'$teal',True),
      text('paper-body',[60,198,490,105],'模型同時納入 FESS、DRBN、CAES 與氫—甲醇儲能，覆蓋全時間尺度調度。\n證據類型：論文模擬／預印本。',18,'$ink',lh=1.45),
      line('metric-split',[585,140,2,220],'$line',1.2,points='50,0 50,100'),
      text('m1',[625,142,275,52],'97.4%',38,'$copper',True),
      text('m1-label',[625,198,275,42],'特定模擬之淨負載平抑率',15,'$gray'),
      text('m2',[625,254,275,52],'62.2%',38,'$copper',True),
      text('m2-label',[625,310,275,42],'特定模擬之綜合循環效率',15,'$gray'),
      rect('boundary',[60,375,840,78],'$teal'),
      text('boundary-text',[82,390,795,46],'可防守缺口：單體／模組開關暫態、共 DC-link 阻抗、故障功率橋接、EIS 品質與 HIL／台架整合。',19,'$white',True,align=('left','middle'),lh=1.25),
      src('src','arXiv:2603.21651｜97.4% 與 62.2% 不是通用工程實績',U['paiz'])]
files.append(add(7,'direct_prior',p))

# 08 EIS prior
p=base(8,'RBS-EIS 也有三個直接前案：差異應放在飛輪掩護與服務連續性','02｜EIS PRIOR ART')
e=p['elements']
e += [line('eis-axis',[120,150,3,255],'$line',3,points='50,0 50,100'),
      rect('n2020',[108,156,26,26],'$teal'),text('t2020',[60,195,125,25],'2020',18,'$teal',True,align=('center','top')),
      text('k2020',[175,150,310,82],'Kersten｜IECON\nRBS／多階逆變器線上阻抗估計',18,'$ink',lh=1.35),
      rect('n2024',[108,245,26,26],'$teal'),text('t2024',[60,284,125,25],'2024',18,'$teal',True,align=('center','top')),
      text('k2024',[175,239,310,82],'Chen｜IEEE TTE\n16 芯 MSPWM 線上 EIS，無額外可程式電源',18,'$ink',lh=1.35),
      rect('n2026',[108,334,26,26],'$copper'),text('t2026',[60,373,125,25],'2026',18,'$copper',True,align=('center','top')),
      text('k2026',[175,328,310,82],'Peng｜IEEE TPEL\n以 RBS 切換暫態同步萃取電芯阻抗',18,'$ink',lh=1.35),
      line('right-split',[535,145,2,270],'$line',1.2,points='50,0 50,100'),
      text('new-title',[575,150,325,30],'本計畫新增的可驗證問題',20,'$copper',True),
      text('new-body',[575,198,325,168],bullet_lines(['飛輪吸收激勵功率，對外服務不間斷','多電芯頻譜解混與時間同步校正','EIS／SOH 結果即時改變拓撲與功率限制','在實測雜訊下設定明確停止條件']),17,'$ink',lh=1.45),
      src_multi('src',[('Kersten 2020',U['kersten']),('Chen 2024',U['chen']),('Peng 2026',U['peng'])])]
files.append(add(8,'eis_prior',p))

# 09 Four modes
p=base(9,'同一套系統必須通過正常、重構、診斷與故障四種模式','03｜OPERATING MODES')
e=p['elements']
e += [image('modes',[90,128,780,339],'media/fig2_modes.png','contain'),
      text('mode-note',[120,467,720,18],'四種模式共享健康度、功率與保護狀態；不能各自開發、各自驗收。',12,'$gray',align=('center','top'))]
files.append(add(9,'modes',p))

# 10 Architecture choices
p=base(10,'架構 A 保底、B 主攻、B2 可停止、C 留給中長期放大','03｜ARCHITECTURE CHOICE')
e=p['elements']
e += [table('arch-table',[45,136,870,286],['架構','工程價值','主要代價','角色'],[
      ['A｜固定 DC-link／AC 耦合','邊界清楚、改造快','轉換級較多；功率分流新穎性低','MVP 保底'],
      ['B｜共 DC＋選擇性 DC/DC','可研究重構暫態、阻抗與診斷','湧流、環流、控制耦合','主研究'],
      ['B2｜可變 DC 直接耦合','有機會減少主功率級','離散階躍、PCS／PMSM／保護受限','高風險子題'],
      ['C｜MMC／多埠／TAB／MAB','中壓與 MW 擴展','磁件、控制、認證最複雜','2–3 年後']],[0.25,0.26,0.32,0.17],13),
      rect('choice',[60,440,840,32],'$pale'),
      text('choice-text',[78,447,805,20],'B2 的省轉換級主張不得成為主計畫成功的必要條件。',15,'$teal',True,lh=1.0)]
files.append(add(10,'architectures',p))

# 11 Main architecture
p=base(11,'主攻架構保留必要調壓與保護，讓重構成為可控制事件','03｜TARGET ARCHITECTURE')
e=p['elements']
e += [image('architecture',[70,123,820,349],'media/fig1_architecture.png','contain'),
      text('io',[95,468,770,20],'輸入：負載／飛輪／模組／保護狀態　→　輸出：對外功率、模組命令、拓撲、隔離與降額',12,'$gray',align=('center','top'))]
files.append(add(11,'target_architecture',p))

# 12 Stability and transient
p=base(12,'重構安全需要「預測缺口 → 飛輪前饋 → 安全切換 → 阻尼收斂」','04｜TRANSIENT & STABILITY')
e=p['elements']
steps=[('01','估計母線能量缺口'),('02','飛輪功率前饋'),('03','執行組態白名單切換'),('04','主動阻尼與功率重收斂')]
for i,(n,s) in enumerate(steps):
    x=60+i*215
    e += [text(f'n{i}',[x,146,45,28],n,20,'$copper',True),text(f's{i}',[x,185,180,58],s,18,'$ink',True,lh=1.25)]
    if i<3: e += [line(f'a{i}',[x+175,163,35,4],'$copper',2,arrow=[None,'stealth'])]
e += [line('kpi-rule',[60,269,840,2],'$line',1),
      text('kpi-title',[60,292,180,28],'建議驗收目標',20,'$teal',True),
      text('kpi1',[60,337,250,64],'＜2 pu／＜1 ms\n重構湧流',24,'$copper',True,lh=1.25),
      text('kpi2',[350,337,250,64],'＜5%／＜10 ms\nDC-link 缺口',24,'$copper',True,lh=1.25),
      text('kpi3',[650,337,250,64],'＜2%\nPCS 功率擾動',24,'$copper',True,lh=1.25),
      text('kpi-note',[60,430,840,30],'全部為立項建議；需在最不利電壓差、SOC、負載與允許拓撲下驗證。',14,'$gray'),
      src('src','技術方法與邊界見 Word 報告第五、六章',U['hu'])]
files.append(add(12,'transient',p))

# 13 Fault bridge
p=base(13,'故障橋接的承諾有邊界：能量足夠才橋接，不足必須安全降額','04｜FAULT BRIDGING')
e=p['elements']
e += [image('fault',[70,124,820,339],'media/fig3_fault_bridge.png','contain'),
      text('fault-kpi',[95,466,770,20],'建議目標｜單模組失效輸出跌落＜5%；不擴大故障；可恢復或安全降額',13,'$copper',True,align=('center','top'))]
files.append(add(13,'fault_bridge',p))

# 14 EIS under cover
p=base(14,'EIS 的價值不在產生報表，而在即時改變功率限制與拓撲','04｜DIAGNOSTIC-DRIVEN RECONFIGURATION')
e=p['elements']
e += [image('eis-loop',[70,124,820,339],'media/fig4_eis_loop.png','contain'),
      text('eis-kpi',[95,466,770,20],'建議目標｜中頻幅值誤差＜5%、低頻＜10%；量測＜60 s；對外功率擾動＜2%',13,'$copper',True,align=('center','top'))]
files.append(add(14,'eis_loop',p))

# 15 Measurement quality
p=base(15,'多電芯 EIS 的成敗先在量測可信度，再才是估計演算法','04｜MEASUREMENT QUALITY')
e=p['elements']
e += [text('left-title',[60,140,360,28],'三種激勵同機比較',20,'$teal',True),
      text('modes',[60,185,370,112],bullet_lines(['MSPWM 型激勵','RAIBA 切換暫態激勵','混合激勵＋飛輪功率掩護']),18,'$ink',lh=1.55),
      text('control-title',[60,330,360,26],'必要控制組',19,'$teal',True),
      text('controls',[60,366,370,70],'無飛輪｜不同步取樣｜不同雜訊\n不同負載｜不同 SOC／溫度',16,'$gray',lh=1.45),
      line('split',[465,142,2,300],'$line',1.2,points='50,0 50,100'),
      text('right-title',[505,140,395,28],'四個常見失真來源',20,'$copper',True),
      text('risks',[505,185,395,160],bullet_lines(['串聯電流與單模組電壓時間差','多模組頻率碰撞與頻譜污染','濾波器相位、插值與窗函數差異','非線性、溫漂與負載變動']),18,'$ink',lh=1.5),
      rect('gate',[505,382,395,58],'$teal'),
      text('gate-text',[522,395,360,32],'G1 未通過：先修量測，禁止進入性能比較。',17,'$white',True,align=('left','middle')),
      src_multi('src',[('EIS 前案｜Chen 2024',U['chen']),('Peng 2026',U['peng'])])]
files.append(add(15,'measurement',p))

# 16 Topic portfolio
p=base(16,'十二項議題：六項主計畫、三項放大、兩項基礎、一項高風險','05｜R&D PORTFOLIO')
e=p['elements']
rows=[
 ['01','共 DC-link 阻抗與小信號穩定','主計畫'],['02','重構暫態、湧流與環流抑制','主計畫'],['03','飛輪功率掩護下服務不間斷 EIS','核心創新'],['04','EIS／SOH 驅動診斷—重構閉環','核心創新'],['05','模組故障隔離與飛輪功率橋接','核心創新'],['06','即時 HIL／PHIL 與故障注入','主計畫'],['07','重構期間構網與虛擬慣量連續性','放大驗證'],['08','多時間尺度 EMS 與飛輪 SOC 自恢復','基礎必要'],['09','異質／退役電池不對稱老化管理','RAIBA 主場'],['10','可變母線下 PMSM 弱磁／共模／軸承電流','B2 高風險'],['11','DC 短路保護、選擇性與認證組態','安全必成'],['12','LCOS、開關網成本、損耗與可靠度','商業必要']]
e += [table('topics',[90,127,780,340],['#','研發議題','定位'],rows,[0.08,0.70,0.22],12,rowHeights=[0.10]+[0.90/12]*12)]
files.append(add(16,'topics',p))

# 17 KPI
p=base(17,'驗收必須同時看暫態、服務、診斷、效率與成本','05｜ACCEPTANCE KPI')
e=p['elements']
e += [table('kpi-table',[45,128,870,306],['面向','12 個月建議目標','驗收邊界'],[
      ['重構','湧流＜2 pu／＜1 ms；DC 缺口＜5%／＜10 ms','最不利組態與負載'],
      ['服務','PCS 擾動＜2%；單模組失效輸出跌落＜5%','飛輪能量足／不足分開'],
      ['高頻電流','＞0.1 Hz 分量相對無飛輪衰減≥20 dB','同 trace／頻譜／窗函數'],
      ['EIS','中頻＜5%；低頻＜10%；＜60 s','指定 SOC／溫度／參考儀器'],
      ['即時／HIL','EMS＜10 ms；暫態誤差＜10%；故障≥50 例','最壞執行時間／同事件'],
      ['效率','架構 B 全工況淨增益目標≥1.5%','含待機與輔助功耗']],[0.18,0.49,0.33],12),
      rect('kpi-warning',[60,452,840,26],'$copper'),
      text('kpi-warning-text',[76,457,810,16],'所有 KPI 都是立項建議，不是現有成果；M0–M2 依設備與場域正式凍結。',12,'$white',True,lh=1.0)]
files.append(add(17,'kpi',p))

# 18 Experiment matrix
p=base(18,'B0–B3 的 2×2 對照，才能辨識飛輪與重構的交互綜效','05｜EXPERIMENT DESIGN')
e=p['elements']
e += [image('matrix',[70,123,820,349],'media/fig5_experiment_matrix.png','contain'),
      text('formula',[100,467,760,18],'Δinteraction＝Y(B3)－Y(B2)－Y(B1)＋Y(B0)｜需重複實驗與不確定性分析',12,'$gray',align=('center','top'))]
files.append(add(18,'matrix',p))

# 19 MVP
p=base(19,'12 個月 MVP 以兩道技術 Gate 決定是否放大','06｜12-MONTH MVP')
e=p['elements']
e += [image('roadmap',[70,122,820,349],'media/fig6_roadmap.png','contain'),
      text('gates',[90,467,780,20],'G1 量測可信｜G2 暫態＋EIS 雙門檻｜G3 故障、效率與 LCOS 決定 50–100 kW',12,'$copper',True,align=('center','top'))]
files.append(add(19,'mvp',p))

# 20 Scale-up
p=base(20,'放大不是既定時程，而是由證據、場域與認證共同觸發','06｜SCALE-UP & FALLBACK')
e=p['elements']
e += [text('y2',[60,137,180,30],'第 2 年',22,'$teal',True),
      text('y2-title',[60,177,260,30],'50–100 kW 工程驗證',20,'$ink',True),
      text('y2-body',[60,219,350,112],bullet_lines(['真實功率元件、熱與 EMI','保護選擇性與長時間運轉','有限可認證組態與維護流程','第三方測試與場域 LCOS']),17,'$ink',lh=1.45),
      line('scale-arrow',[365,174,140,4],'$copper',3,arrow=[None,'stealth']),
      text('y3',[535,137,180,30],'第 3 年',22,'$teal',True),
      text('y3-title',[535,177,365,30],'100 kW–MW 示範｜另行決策',20,'$ink',True),
      text('y3-body',[535,219,365,112],bullet_lines(['交互綜效顯著且對誤差穩健','設備、場域與安規同時成立','需要中壓時才評估 MMC／多埠','以可用率與 LCOS 驗收']),17,'$ink',lh=1.45),
      text('kill-line',[60,337,840,30],'Kill｜B2 緩衝／預充＞省下 DC/DC 50%；EIS 中頻誤差＞10%；交互綜效＜3%；LCOS＞傳統 HESS 1.05×且無場域翻正。',11,'$copper',True,lh=1.15),
      rect('fallback',[60,373,840,73],'$teal'),
      text('fallback-text',[82,387,795,42],'退守路線｜暫態與 EIS 同時失敗：架構 A＋RAIBA 診斷與健康管理，不進入高功率原型。',18,'$white',True,align=('left','middle'),lh=1.25)]
files.append(add(20,'scaleup',p))

# 21 Global industry
p=base(21,'全球工程已證明飛輪可做成調頻、長時與混合儲能，但邊界不同','07｜GLOBAL INDUSTRY')
e=p['elements']
e += [image('beacon',[60,137,445,142],'media/4_Hazle_Township_Pennsylvania_Beacon.png','cover'),
      text('beacon-title',[60,293,445,26],'Beacon Hazle｜20 MW／5 MWh',19,'$teal',True),
      text('beacon-body',[60,326,445,66],'200 台 100 kW／25 kWh\nDOE 工程報告｜短時高功率調頻',16,'$ink',lh=1.35),
      image('s4',[540,137,360,221],'media/3_Flywheel_lithium_battery_hybrid_energy.png','cover'),
      text('s4-title',[540,371,360,26],'S4／Leclanché Almelo',18,'$teal',True),
      text('s4-body',[540,402,360,56],'8.8 MW／7.12 MWh 電池＋3 MW 飛輪\n提供 9 MW FCR｜企業工程案例',14,'$ink',lh=1.3),
      text('amber-note',[60,414,445,44],'另一條路線｜Amber M32：8 kW／32 kWh、4 h\nDC RTE＞86% 與 30 年設計壽命屬企業資料表宣稱',13,'$gray',lh=1.25),
      src_multi('src',[('DOE Hazle',U['doe']),('Leclanché／S4',U['s4']),('Amber M32',U['amber'])])]
files.append(add(21,'global_industry',p))

# 22 China Taiwan
p=base(22,'中國與台灣對標：DRBN 工程與中壓飛輪 UPS 都已存在','07｜CHINA & TAIWAN')
e=p['elements']
e += [text('drbn-title',[60,137,430,28],'清華慈松 DRBN｜直接工程 benchmark',20,'$teal',True),
      text('drbn-metrics',[60,182,410,72],'94.84%　84.06%　99.3%',28,'$copper',True),
      text('drbn-labels',[60,247,420,56],'電池簇直流側效率｜系統綜合效率｜可用係數\n2025 年 1 月投運；相容 5 種模組',15,'$gray',lh=1.35),
      text('rui-title',[60,330,420,26],'芮城混合儲能｜100 MW／50.41 MWh',18,'$teal',True),
      text('rui-body',[60,367,420,64],'飛輪 50 MW／0.41 MWh\nLFP 50 MW／50 MWh｜政府併網資料',16,'$ink',lh=1.35),
      line('split',[515,140,2,300],'$line',1.2,points='50,0 50,100'),
      text('delta-title',[555,137,345,54],'台達 × 泓慧\nSST＋飛輪 10 kV 中壓 UPS',21,'$teal',True,lh=1.25),
      text('delta-metric',[555,219,345,52],'1–24 MW',34,'$copper',True),
      text('delta-body',[555,278,345,78],'企業新聞稿所列產品範圍。\n效率等性能屬企業宣稱，需第三方驗證。',16,'$ink',lh=1.4),
      rect('benchmark',[555,388,345,54],'$pale'),
      text('benchmark-text',[572,400,312,30],'RAIBA 不能只對標固定串併聯電池。',16,'$teal',True,align=('left','middle')),
      src_multi('src',[('清華 DRBN 驗收',U['drbn']),('芮城｜山西省政府',U['ruicheng']),('台達×泓慧',U['delta'])])]
files.append(add(22,'china_taiwan',p))

# 23 Applications and partners
p=base(23,'先選能同時評價功率、連續性與維修的場域，再組合作資料鏈','08｜APPLICATION & PARTNERS')
e=p['elements']
e += [text('apps-title',[60,137,350,26],'應用優先級',20,'$teal',True),
      text('app1',[60,180,350,64],'<p><strong>1｜AIDC／半導體／關鍵製程</strong></p><p>瞬時功率＋服務連續＋長時備電</p>',17,'$ink',lh=1.35),
      text('app2',[60,262,350,64],'<p><strong>2｜工業微電網／弱電網快充</strong></p><p>高功率脈衝與電網容量限制</p>',17,'$ink',lh=1.35),
      text('app3',[60,344,350,64],'<p><strong>3｜調頻／風光平抑</strong></p><p>適合落地，不宜作主要新穎性</p>',17,'$ink',lh=1.35),
      line('split',[450,142,2,285],'$line',1.2,points='50,0 50,100'),
      text('partners-title',[490,137,410,26],'合作不是只借設備，而是取得可驗證資料',20,'$copper',True),
      text('partners',[490,180,410,192],bullet_lines(['工研院／RAIBA：背景 IP、切換序列與原始測試','飛輪供應商：全轉速模型、效率、故障與安全','DRBN 生態系：成熟工程效率與可用率對標','UPS／PCS／SST：關鍵電力介面與認證','學研＋場域：HIL、真實 trace 與停機成本']),16,'$ink',lh=1.45),
      rect('partner-rule',[490,403,410,38],'$teal'),
      text('partner-rule-text',[505,412,380,20],'資料權利、改良 IP 與公開授權須先約定。',14,'$white',True,lh=1.0)]
files.append(add(23,'applications',p))

# 24 Final
p=base(24,'核准的是一套可證偽的研發計畫，不是一組未驗證的性能承諾','09｜FINAL DECISION')
e=p['elements']
e += [text('decision',[60,137,350,54],'有條件通過',34,'$copper',True),
      text('decision-sub',[60,200,350,88],'12 個月完成可信對照、暫態安全、故障橋接與診斷閉環；通過後再決定放大。',19,'$ink',lh=1.4),
      line('split',[445,140,2,285],'$copper',2,points='50,0 50,100'),
      text('conditions-title',[485,137,415,26],'四個核准條件',20,'$teal',True),
      text('conditions',[485,178,415,160],bullet_lines(['B0–B3 四組對照不可刪','暫態與 EIS 設獨立 Gate','效率／延壽／可用率不得先寫成成果','B2 未過成本與暫態門檻即停止']),17,'$ink',lh=1.5),
      text('data-title',[485,365,415,24],'立項前必收',17,'$copper',True),
      text('data',[485,398,415,54],'RAIBA 開關與失效資料｜飛輪全轉速模型\n真實負載 trace｜異質老化資料｜IP／認證邊界',14,'$gray',lh=1.35),
      rect('final-band',[60,460,840,26],'$teal'),
      text('final-text',[75,465,810,16],'主計畫名稱｜飛輪功率掩護下之 RAIBA：重構暫態穩定、故障功率橋接與診斷驅動重構',12,'$white',True,lh=1.0)]
files.append(add(24,'final',p))

entry={
 'version':'v2','title':'飛輪儲能 × RAIBA 可重構電池系統技術研發立項簡報','size':[960,540],
 'customFonts':[
   {'family':'MiSans','src':'https://statics.kimi.ai/neo-design-static/p-font/MiSans.ttf'},
   {'family':'Liter','src':'https://statics.kimi.ai/neo-design-static/p-font/Liter.ttf'}],
 'theme':{
   'colors':C,
   'textStyles':{
     'title':{'fontSize':28,'color':'$teal','bold':True,'fontFamily':{'latin':'Liter','ea':'MiSans'}},
     'body':{'fontSize':18,'color':'$ink','fontFamily':{'latin':'Liter','ea':'MiSans'},'lineHeight':1.25},
     'note':{'fontSize':10,'color':'$gray','fontFamily':{'latin':'Liter','ea':'MiSans'}}},
   'tableStyles':{}},
 'pages':files}
with open(ROOT/'飛輪儲能_RAIBA_技術研發立項簡報.pptd','w',encoding='utf-8') as f:
    yaml.safe_dump(entry,f,allow_unicode=True,sort_keys=False,width=160)
print(f'Wrote {len(files)} pages to {ROOT}')
