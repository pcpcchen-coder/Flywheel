from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
BOLD = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
C = {'paper':'#F7F4ED','ink':'#22302E','teal':'#245C57','copper':'#B65D38','gray':'#6B756F','light':'#E5E0D5','white':'#FFFFFF','pale':'#D8E4DF'}

def f(sz,b=False): return ImageFont.truetype(BOLD if b else FONT, sz)
def canvas():
    im=Image.new('RGB',(1600,900),C['paper']); return im,ImageDraw.Draw(im)
def text(d,xy,s,sz=30,col=None,b=False,anchor=None): d.text(xy,s,font=f(sz,b),fill=col or C['ink'],anchor=anchor)
def box(d,xy,fill=None,outline=None,w=3): d.rectangle(xy,fill=fill,outline=outline,width=w)
def arrow(d,p1,p2,col=None,w=5):
    col=col or C['teal']; d.line([p1,p2],fill=col,width=w)
    import math
    ang=math.atan2(p2[1]-p1[1],p2[0]-p1[0]); L=18
    pts=[p2,(p2[0]-L*math.cos(ang-0.55),p2[1]-L*math.sin(ang-0.55)),(p2[0]-L*math.cos(ang+0.55),p2[1]-L*math.sin(ang+0.55))]
    d.polygon(pts,fill=col)
def title(d,s,sub=None):
    text(d,(70,48),s,42,C['ink'],True); d.line((70,112,1530,112),fill=C['teal'],width=4)
    if sub: text(d,(70,130),sub,24,C['gray'])

# 1. Recommended architecture
im,d=canvas(); title(d,'建議主攻架構：共直流母線＋選擇性雙向 DC/DC＋RAIBA','功率流、量測與控制分層；B2 可變母線直接耦合列為高風險子題')
box(d,(70,275,285,435),C['white'],C['ink']); text(d,(177,325),'電網／關鍵負載',30,C['ink'],True,'mm'); text(d,(177,375),'AC 功率輸出入',24,C['gray'],False,'mm')
box(d,(390,275,590,435),C['pale'],C['teal']); text(d,(490,325),'PCS／構網變流器',29,C['teal'],True,'mm'); text(d,(490,375),'對外服務連續性',24,C['gray'],False,'mm')
arrow(d,(285,355),(390,355)); arrow(d,(390,375),(285,375))
d.line((590,355,720,355),fill=C['teal'],width=8); d.line((720,230,720,650),fill=C['teal'],width=8)
text(d,(705,680),'共直流母線 DC-link',28,C['teal'],True,'mm')
box(d,(830,165,1100,305),C['white'],C['teal']); text(d,(965,215),'飛輪雙向變流器',29,C['teal'],True,'mm'); text(d,(965,260),'毫秒級功率掩護',24,C['gray'],False,'mm')
box(d,(1220,165,1490,305),C['white'],C['ink']); text(d,(1355,215),'PMSM＋飛輪',30,C['ink'],True,'mm'); text(d,(1355,260),'轉速／SOC／可用能量',23,C['gray'],False,'mm')
arrow(d,(720,235),(830,235)); arrow(d,(830,255),(720,255)); arrow(d,(1100,235),(1220,235)); arrow(d,(1220,255),(1100,255))
box(d,(830,440,1100,580),C['white'],C['copper']); text(d,(965,490),'選擇性雙向 DC/DC',28,C['copper'],True,'mm'); text(d,(965,535),'保留必要隔離與調壓',23,C['gray'],False,'mm')
box(d,(1220,420,1490,600),C['white'],C['copper']); text(d,(1355,465),'RAIBA 開關矩陣',29,C['copper'],True,'mm'); text(d,(1355,515),'串併聯／旁路／輪替',24,C['gray'],False,'mm'); text(d,(1355,555),'異質電池模組',24,C['gray'],False,'mm')
arrow(d,(720,510),(830,510)); arrow(d,(830,530),(720,530)); arrow(d,(1100,510),(1220,510)); arrow(d,(1220,530),(1100,530))
box(d,(350,730,1250,840),C['ink'],C['ink']); text(d,(800,765),'EMS＋數位孿生＋保護協調',31,C['white'],True,'mm'); text(d,(800,808),'同步 V／I／T／EIS／SOH → 功率分配、拓撲選擇、故障隔離',25,C['white'],False,'mm')
d.line((965,580,965,730),fill=C['gray'],width=3); d.line((1355,600,1355,680,1200,680,1200,730),fill=C['gray'],width=3)
im.save(OUT/'fig1_architecture.png')

# 2. Four operating modes
im,d=canvas(); title(d,'研究範圍涵蓋四種運轉模式','創新價值落在重構、診斷與故障工況，而非僅比較穩態功率曲線')
modes=[('01 正常運轉','飛輪處理高頻功率\nRAIBA 管理模組老化與輸出','時間域＋空間域分工'),('02 重構暫態','飛輪前饋補償\n抑制母線缺口、湧流與環流','阻抗穩定與切換安全'),('03 線上診斷','飛輪維持對外功率\n電池脫載或接受雙向激勵','服務不間斷 EIS'),('04 故障隔離','先橋接、再旁路、後重建\n必要時降額恢復','功率橋接與保護選擇性')]
for i,(a,b,c) in enumerate(modes):
    x=90+i*375; box(d,(x,230,x+330,650),C['white'],C['light']); d.line((x,230,x+330,230),fill=C['copper'] if i else C['teal'],width=8)
    text(d,(x+25,270),a,32,C['copper'] if i else C['teal'],True)
    for j,line in enumerate(b.split('\n')): text(d,(x+25,350+j*60),line,27,C['ink'])
    d.line((x+25,500,x+305,500),fill=C['light'],width=2); text(d,(x+25,540),c,25,C['gray'])
text(d,(90,735),'共同驗收基準',25,C['gray']); text(d,(90,780),'安全交付能量｜系統可用率｜重構期間對外功率擾動｜EIS 量測品質',33,C['ink'],True)
im.save(OUT/'fig2_modes.png')

# 3. Fault bridging sequence
im,d=canvas(); title(d,'故障處理順序：飛輪先補功率，RAIBA 再完成隔離與重建','橋接時間必須覆蓋最壞故障偵測＋安全隔離＋拓撲重建時間')
steps=[('t0','故障發生','模組過溫、內短路\n開關或感測器異常'),('t1','偵測與確認','交叉比對 V／I／T\n避免誤旁路'),('t2','飛輪橋接','快速補償功率缺口\n限制 DC-link 擾動'),('t3','RAIBA 隔離','執行安全開關序列\n維持電流路徑'),('t4','拓撲重建','重算可用功率與能量\n更新 PCS 限值'),('t5','降額恢復','恢復對外服務\n記錄故障與健康度')]
for i,(t,a,b) in enumerate(steps):
    x=65+i*250; d.ellipse((x,255,x+74,329),fill=C['copper'] if i in (2,3,4) else C['teal']); text(d,(x+37,292),t,24,C['white'],True,'mm')
    if i<5: arrow(d,(x+74,292),(x+245,292),C['gray'],3)
    text(d,(x,380),a,29,C['ink'],True)
    for j,line in enumerate(b.split('\n')): text(d,(x,440+j*50),line,24,C['gray'])
box(d,(90,650,1510,790),C['pale'],None); text(d,(125,685),'建議驗收目標',25,C['teal'],True); text(d,(125,730),'單模組失效後輸出功率跌落＜5%；不擴大故障；可降額持續運轉；故障案例≥50',31,C['ink'],True)
im.save(OUT/'fig3_fault_bridge.png')

# 4. EIS measurement and closed loop
im,d=canvas(); title(d,'飛輪功率掩護下的 EIS：先取得乾淨激勵，再回授拓撲決策','既有 RBS-EIS 文獻已存在；本計畫新增的是高功率服務不間斷與控制閉環')
box(d,(75,220,365,390),C['white'],C['teal']); text(d,(220,265),'飛輪功率掩護',30,C['teal'],True,'mm'); text(d,(220,325),'承擔負載／提供雙向功率',24,C['gray'],False,'mm')
box(d,(475,220,790,390),C['white'],C['copper']); text(d,(632,265),'RAIBA 診斷激勵',30,C['copper'],True,'mm'); text(d,(632,325),'脫載、PWM 或切換暫態',24,C['gray'],False,'mm')
box(d,(900,220,1230,390),C['white'],C['ink']); text(d,(1065,265),'同步量測與估計',30,C['ink'],True,'mm'); text(d,(1065,325),'V／I 同步、去噪、阻抗擬合',24,C['gray'],False,'mm')
arrow(d,(365,305),(475,305)); arrow(d,(790,305),(900,305))
box(d,(1260,220,1510,390),C['pale'],C['teal']); text(d,(1385,265),'EIS／SOH',32,C['teal'],True,'mm'); text(d,(1385,325),'模組健康度排序',24,C['gray'],False,'mm')
arrow(d,(1230,305),(1260,305))
box(d,(440,535,1160,720),C['ink'],C['ink']); text(d,(800,580),'診斷驅動重構',34,C['white'],True,'mm'); text(d,(800,635),'功率上限｜模組輪替｜旁路｜串併聯選擇',28,C['white'],False,'mm'); text(d,(800,680),'同時更新安全交付能量與維修策略',25,C['white'],False,'mm')
arrow(d,(1385,390),(1160,625),C['copper'],5); arrow(d,(440,625),(220,390),C['copper'],5)
text(d,(90,805),'量測風險：時間差｜mΩ／mV 雜訊｜EMI｜Rds(on) 溫漂｜多電芯 CPU／通訊負載',27,C['gray'])
im.save(OUT/'fig4_eis_loop.png')

# 5. 2x2 experiment matrix
im,d=canvas(); title(d,'2×2 對照才能辨識「飛輪×RAIBA」的交互綜效','缺少 B1 或 B2，就無法拆解單一技術與組合技術的貢獻')
x0,y0=400,220; cw,ch=520,220
text(d,(660,165),'無飛輪',32,C['ink'],True,'mm'); text(d,(1180,165),'有飛輪',32,C['ink'],True,'mm')
text(d,(220,330),'固定串併聯電池',30,C['ink'],True,'mm'); text(d,(220,550),'RAIBA 可重構電池',30,C['ink'],True,'mm')
items=[(x0,y0,'B0','傳統電池基線','固定拓撲、無功率掩護'),(x0+cw,y0,'B1','飛輪單獨貢獻','高頻削峰、SOC 自恢復'),(x0,y0+ch,'B2','RAIBA 單獨貢獻','重構、旁路、模組輪替'),(x0+cw,y0+ch,'B3','組合與交互綜效','暫態、EIS、故障橋接')]
for x,y,b,a,c in items:
    fill=C['pale'] if b=='B3' else C['white']; outline=C['copper'] if b=='B3' else C['light']; box(d,(x,y,x+cw-20,y+ch-20),fill,outline,4)
    text(d,(x+30,y+28),b,38,C['copper'] if b=='B3' else C['teal'],True); text(d,(x+115,y+33),a,30,C['ink'],True); text(d,(x+30,y+105),c,26,C['gray'])
text(d,(400,735),'比較面向',25,C['gray']); text(d,(400,780),'效率｜電池高頻電流｜EIS 誤差｜故障輸出跌落｜安全交付能量｜LCOS',31,C['ink'],True)
im.save(OUT/'fig5_experiment_matrix.png')

# 6. Roadmap
im,d=canvas(); title(d,'12 個月 MVP 與 2–3 年放大路線','先證明暫態、診斷與故障橋接，再決定是否放大功率與減少轉換級')
phases=[('M0–M2','需求與量測基線','負載 trace、B0–B3、同步量測\nGate 1：量測可信度'),('M3–M5','架構 A 台架＋B 模型','10–30 kW 級台架、開關級 HIL\n建立正常功率分流基線'),('M6–M8','暫態與 EIS','重構補償、三種診斷模式\nGate 2：暫態／EIS 雙門檻'),('M9–M12','故障與技術經濟','≥50 故障案例、效率／LCOS\n決定是否進入 50–100 kW')]
for i,(a,b,c) in enumerate(phases):
    x=80+i*375; box(d,(x,205,x+335,515),C['white'],C['light']); text(d,(x+25,235),a,30,C['copper'],True); text(d,(x+25,295),b,29,C['ink'],True)
    for j,line in enumerate(c.split('\n')): text(d,(x+25,365+j*58),line,23,C['gray'])
    if i<3: arrow(d,(x+335,360),(x+370,360),C['copper'],4)
text(d,(90,590),'第 2 年',29,C['teal'],True); text(d,(250,590),'50–100 kW 工程驗證｜長時運轉｜EMC／熱／保護｜構網與故障穿越',29,C['ink'])
d.line((90,645,1510,645),fill=C['light'],width=2)
text(d,(90,695),'第 3 年',29,C['teal'],True); text(d,(250,695),'100 kW–MW 示範（依 Gate 與場域決定）｜鎖定認證組態｜全壽命經濟驗證',29,C['ink'])
box(d,(90,775,1510,835),C['pale'],None); text(d,(800,805),'B2 可變母線直接耦合若未過成本與暫態門檻，立即停止，不拖累主計畫',28,C['copper'],True,'mm')
im.save(OUT/'fig6_roadmap.png')

print('Generated 6 figures in', OUT)
