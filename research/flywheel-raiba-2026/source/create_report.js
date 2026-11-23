import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, Document, ExternalHyperlink, Footer, FootnoteReferenceRun,
  Header, HeadingLevel, ImageRun, ImportedXmlComponent, LevelFormat,
  Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, WidthType, convertInchesToTwip,
} from "docx";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node create_report.js /absolute/path/report.docx");
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(sourceDir, "assets");
const T = String.raw;
const C = { ink:"22302E", teal:"245C57", copper:"B65D38", gray:"6B756F", light:"E5E0D5", pale:"EDF2EE", paper:"F7F4ED", white:"FFFFFF" };
const font = { ascii:"Arial", hAnsi:"Arial", cs:"Arial", eastAsia:"Microsoft JhengHei" };
const run = (text, options={}) => new TextRun({ text, font, size:22, color:C.ink, ...options });
const para = (children, options={}) => new Paragraph({
  spacing:{after:140,line:320}, children:Array.isArray(children)?children:[children], ...options,
});
const body = (text, options={}) => para(run(text), {indent:{firstLine:convertInchesToTwip(0.31)}, alignment:AlignmentType.JUSTIFIED, ...options});
const note = (text) => para(run(text,{size:18,color:C.gray,italics:true}),{spacing:{after:100,line:260}});
const h1 = (text) => para(run(text,{bold:true,size:32,color:C.teal}),{heading:HeadingLevel.HEADING_1,spacing:{before:340,after:180},keepNext:true});
const h2 = (text) => para(run(text,{bold:true,size:26,color:C.ink}),{heading:HeadingLevel.HEADING_2,spacing:{before:260,after:140},keepNext:true});
const h3 = (text) => para(run(text,{bold:true,size:23,color:C.copper}),{heading:HeadingLevel.HEADING_3,spacing:{before:200,after:100},keepNext:true});
const bullet = (text, level=0) => para(run(text),{numbering:{reference:"bullets",level},indent:{left:360+level*360,hanging:240},spacing:{after:80,line:300}});
const numbered = (text, level=0) => para(run(text),{numbering:{reference:"numbers",level},indent:{left:360+level*360,hanging:240},spacing:{after:80,line:300}});
const pageBreak = () => para(new PageBreak(),{spacing:{after:0}});
const caption = (text) => para(run(text,{size:18,color:C.gray}),{alignment:AlignmentType.CENTER,spacing:{after:180,line:240}});
const cite = (id) => new FootnoteReferenceRun(id);
function cited(text,id){ return para([run(text),cite(id)],{indent:{firstLine:convertInchesToTwip(0.31)},alignment:AlignmentType.JUSTIFIED}); }

const src = {
  1:"Tzi-cker Chiueh, Mao-Cheng Huang, Kai-Cheung Juang, Shih-Hao Liang, Welkin Ling, “Virtualizing Energy Storage Management Using RAIBA,” USENIX ATC 2018. https://www.usenix.org/conference/atc18/presentation/chiueh",
  2:"工研院，「RAIBA 可重組電池儲能系統技術」，技術轉移資料。https://www.itri.org.tw/ListStyle.aspx?DisplayStyle=13_content&SiteID=1&MmmID=1036233405427625204&Trt_idx=6074",
  3:"Song Ci, Ni Lin, Dalei Wu, “Reconfigurable Battery Techniques and Systems: A Survey,” IEEE Access 4 (2016): 1175–1189. DOI:10.1109/ACCESS.2016.2545338",
  4:"Weiji Han et al., “Next-Generation Battery Management Systems: Dynamic Reconfiguration,” IEEE Industrial Electronics Magazine 14(4), 2020:20–31. DOI:10.1109/MIE.2020.3002486",
  5:"C. Hu and Chang-Ming Liaw, “On the flywheel/battery hybrid energy storage system for DC microgrid,” IFEEC 2013, Tainan. DOI:10.1109/IFEEC.2013.6687490",
  6:"A. Kersten et al., “Online and on-board battery impedance estimation of battery cells, modules or packs in a reconfigurable battery system or multilevel inverter,” IECON 2020. DOI:10.1109/IECON43393.2020.9254515",
  7:"Z. Chen et al., “A Novel Multisinusoidal PWM Excitation for Online Battery Impedance Spectroscopy Identification and Implementation by Reconfigurable Battery Systems,” IEEE Transactions on Transportation Electrification, 2024. DOI:10.1109/TTE.2024.3350878",
  8:"J. Peng, W. Xie, J. Meng, H. Liu, “Synchronous Impedance Spectroscopy Extraction From Reconfigurable Lithium-Ion Battery System via Switching Transient Signal,” IEEE Transactions on Power Electronics 41(1), 2026:109–113. DOI:10.1109/TPEL.2025.3600334",
  9:"Paizulamu et al., “Full Timescale Hierarchical MPC-MTIP Framework for Hybrid Energy Storage Management in Low-Carbon Industrial Microgrid,” arXiv:2603.21651, 2026. https://arxiv.org/abs/2603.21651",
  10:"S. Wen et al., “Optimal Configuration of Flywheel–Battery Hybrid Energy Storage System for Smoothing Wind–Solar Power Generating Fluctuation,” Energies 18(8):2055, 2025. DOI:10.3390/en18082055",
  11:"“Application of Flywheel-Battery Hybrid Energy Storage in New Energy Power Station Frequency Regulation,” Energies 19(6):1586, 2026. https://www.mdpi.com/1996-1073/19/6/1586",
  12:"U.S. Department of Energy, “Final Technology Performance Report—Hazle Spindle LLC.” https://www.energy.gov/sites/prod/files/2017/01/f34/02%2005%202016%20-%20Final%20TPR_Hazle%20Spindle%20LLC.pdf",
  13:"Amber Kinetics, “M32 Product Data Sheet（Preliminary）.” https://www.amberkinetics.com/wp-content/uploads/2020/05/Amber-Kinetics-DataSheet.pdf",
  14:"Leclanché, “Leclanché and S4 Energy Complete Hybrid Energy Storage Project to Serve Dutch Frequency Containment Reserve Market,” 2020；Almelo case study. https://www.leclanche.com/leclanche-and-s4-energy-complete-hybrid-energy-storage-project-to-serve-dutch-frequency-containment-reserve-market/",
  15:"Active Power, “CLEANSOURCE PLUS SMS／Data Center Solutions.” https://www.activepower.com/product/cleansource-sms-plus-ups/",
  16:"清華大學電機工程與應用電子技術系，「百兆瓦級動態可重構電池儲能技術」示範工程驗收，2026-01-21。https://www.eea.tsinghua.edu.cn/info/1038/6726.htm",
  17:"山西省人民政府，「一次成功！芮城獨立儲能項目併網」，2025-07-25。https://www.shanxi.gov.cn/zfxxgk/zfxxgkzl/fdzdgknr/zdxm/202507/t20250725_9924573.shtml",
  18:"台達×泓慧能源，「SST＋飛輪儲能 10kV 中壓 UPS」企業新聞稿，2026-04。https://www.prnasia.com/story/529703-1.shtml",
  19:"RAIBA public repository（使用者指定），README；本報告僅使用實際可檢閱內容。https://github.com/pcpcchen-coder/RAIBA",
};
const footnotes = {};
for (const [id,text] of Object.entries(src)) footnotes[id] = {children:[para(run(text,{size:17,color:C.gray}),{spacing:{after:40,line:230}})]};

function cell(text,width,opts={}) {
  const paras = String(text).split("\n").map((line)=>para(run(line,{size:opts.fontSize||18,bold:!!opts.bold,color:opts.color||C.ink}),{spacing:{after:40,line:240},alignment:opts.align||AlignmentType.LEFT}));
  return new TableCell({children:paras,width:{size:width,type:WidthType.DXA},margins:{top:90,bottom:90,left:100,right:100},shading:opts.fill?{type:ShadingType.CLEAR,fill:opts.fill}:undefined,verticalAlign:opts.valign});
}
function table(headers,rows,widths,opts={}) {
  const header = new TableRow({tableHeader:true,children:headers.map((h,i)=>cell(h,widths[i],{bold:true,color:C.white,fill:opts.headerFill||C.teal,fontSize:opts.fontSize||18}))});
  const bodyRows = rows.map((r,ri)=>new TableRow({cantSplit:false,children:r.map((v,i)=>cell(v,widths[i],{fill:ri%2?C.paper:C.white,fontSize:opts.fontSize||18,bold:opts.boldFirst&&i===0}))}));
  return new Table({width:{size:widths.reduce((a,b)=>a+b,0),type:WidthType.DXA},columnWidths:widths,rows:[header,...bodyRows]});
}
function figure(file,width,height,cap){ return [para(new ImageRun({type:"png",data:fs.readFileSync(path.join(assetDir,file)),transformation:{width,height}}),{alignment:AlignmentType.CENTER,spacing:{after:60}}),caption(cap)]; }
function callout(titleText,text){ return table([titleText],[[text]],[9360],{headerFill:C.copper,fontSize:20}); }
const xmlEscape = (v)=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const toc = (entries)=>ImportedXmlComponent.fromXmlString(`<w:sdt xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:sdtPr><w:alias w:val="目錄"/></w:sdtPr><w:sdtContent><w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/><w:instrText xml:space="preserve"> TOC \\o &quot;1-3&quot; \\h \\z \\u </w:instrText><w:fldChar w:fldCharType="separate"/></w:r></w:p>${entries.map(({title,level,page})=>`<w:p><w:pPr><w:pStyle w:val="TOC${level}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs><w:ind w:left="${(level-1)*360}"/></w:pPr><w:r><w:t>${xmlEscape(title)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${page}</w:t></w:r></w:p>`).join("")}<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:sdtContent></w:sdt>`).root[0];

const tocEntries = [
  {title:"執行摘要",level:1,page:3},{title:"一、立項背景、目標與證據邊界",level:1,page:4},
  {title:"二、技術基線：RAIBA 與飛輪的互補關係",level:1,page:5},{title:"三、學術前案、直接競爭文獻與查新修正",level:1,page:6},
  {title:"四、系統架構選擇與建議主攻拓撲",level:1,page:8},{title:"五、十二項研發議題池",level:1,page:10},
  {title:"六、三條核心技術主軸與實驗方法",level:1,page:12},{title:"七、12 個月 MVP 與驗收設計",level:1,page:15},
  {title:"八、2–3 年研發路線與放大條件",level:1,page:16},{title:"九、全球、中國與台灣產業對標",level:1,page:17},
  {title:"十、應用選擇、合作對象與競品關係",level:1,page:19},{title:"十一、風險、停止條件、智慧財產與資料需求",level:1,page:20},
  {title:"十二、立項工作包與最終建議",level:1,page:21},{title:"附錄 A：KPI 與 Kill criteria 總表",level:1,page:22},
  {title:"附錄 B：立項前 RFI 資料清單",level:1,page:23},{title:"參考文獻與資料來源",level:1,page:23},
];

const cover = [
  para(run("研發立項完整報告",{bold:true,size:22,color:C.copper}),{spacing:{before:900,after:280}}),
  para(run("飛輪儲能 × RAIBA",{bold:true,size:52,color:C.teal}),{spacing:{after:160}}),
  para(run("可重構電池系統技術研發議題",{bold:true,size:40,color:C.ink}),{spacing:{after:320}}),
  para(run("重構暫態穩定｜故障功率橋接｜服務不間斷診斷｜全壽命最佳化",{size:24,color:C.gray}),{spacing:{after:700}}),
  table(["報告定位","內容"],[["文件版本","V1.0｜研發立項審查用"],["資料檢索截止","2026 年 11 月 23 日"],["研究範圍","學術文獻、直接前案、系統架構、研發議題、KPI、產業工程與合作對象"],["證據原則","論文實測／模擬、工程事實、企業宣稱與立項建議分層呈現"]],[2300,7060],{fontSize:20}),
  para(run("重要聲明：本報告中的目標 KPI 均為建議驗收門檻，不是目前已有成果；企業規格不視為獨立驗證。",{size:19,color:C.copper,bold:true}),{spacing:{before:400,after:120}}),
];

const bodyChildren = [];
bodyChildren.push(para(run("目錄",{bold:true,size:34,color:C.teal}),{spacing:{after:200}}));
bodyChildren.push(note("目錄頁碼依目前排版填列；若後續編輯內容，可在 Word／WPS 中更新功能變數刷新。"));
bodyChildren.push(toc(tocEntries));
bodyChildren.push(pageBreak());

bodyChildren.push(h1("執行摘要"));
bodyChildren.push(callout("建議決策：有條件通過 12 個月 MVP，不建議直接核准 MW 級全功能系統","主計畫應聚焦「飛輪功率掩護下之 RAIBA 可重構電池系統：重構暫態穩定、故障功率橋接與診斷驅動重構技術」。架構 A 作為保底與快速實證，架構 B 作為主研究，B2 可變 DC-link 直接耦合列為可停止的高風險子題。"));
bodyChildren.push(h2("核心判斷"));
bodyChildren.push(numbered("飛輪—電池的功率分流、SOC 自恢復、容量最佳化及調頻應用已有大量研究與工程，不能作為主要新穎性。"));
bodyChildren.push(numbered("2026 年已出現同時納入 FESS 與 DRBN 的調度層直接前案，因此不可主張「全球首次結合飛輪與可重構電池」。"));
bodyChildren.push(numbered("RBS 透過多階逆變器、PWM 與切換暫態執行線上阻抗估計已有 2020、2024、2026 年直接前案；本計畫必須把差異放在飛輪功率掩護、高品質雙向激勵、服務不間斷與診斷回授控制。"));
bodyChildren.push(numbered("真正可驗證的研究缺口是：共 DC-link 重構暫態與阻抗穩定、故障期間飛輪橋接、EIS／SOH 驅動的拓撲選擇，以及這些功能的 HIL／台架整合。"));
bodyChildren.push(h2("三條核心主軸"));
bodyChildren.push(table(["主軸","要回答的問題","建議量化證據"],[["重構暫態與穩定","改變電池拓撲時，母線、PCS 與飛輪變流器是否仍穩定？","湧流＜2 pu 且＜1 ms；DC-link 缺口＜5%、＜10 ms；PCS 功率擾動＜2%"],["故障功率橋接","模組或開關故障時，飛輪能否覆蓋偵測、隔離與重建所需時間？","單模組失效輸出跌落＜5%；可降額運轉；故障案例≥50"],["功率掩護診斷與閉環","能否不中斷對外服務完成高品質 EIS，並用結果調整拓撲？","中頻阻抗幅值誤差＜5%、低頻＜10%；量測＜60 s；對外功率擾動＜2%"]],[1900,3660,3800]));
bodyChildren.push(h2("建議應用與合作策略"));
bodyChildren.push(body("優先選擇 AIDC、半導體與關鍵製程電力作為高價值驗證場域，因其同時重視瞬時功率、服務連續性與長時備電。工業微電網與弱電網快充列為第二順位；調頻與風光平抑適合成果落地，不宜作為主要研究新穎性。合作上應優先確認工研院 RAIBA 背景 IP、飛輪供應商的全轉速資料及場域真實負載 trace，並把清華慈松 DRBN 工程列為可重構電池的主要 benchmark。"));
bodyChildren.push(h2("四個核准條件"));
bodyChildren.push(bullet("必須配置 B0 固定電池、B1 固定電池＋飛輪、B2 RAIBA、B3 RAIBA＋飛輪四組對照。"));
bodyChildren.push(bullet("暫態與 EIS 必須設獨立 Gate，不能用功率分流模擬取代硬體與量測證據。"));
bodyChildren.push(bullet("效率、壽命與可用率未經測試前，只能列為立項目標，不得寫成既有成果。"));
bodyChildren.push(bullet("B2 若未通過暫態、效率與成本門檻，應立即停止，不得拖累架構 A／B 的診斷與故障成果。"));
bodyChildren.push(pageBreak());

bodyChildren.push(h1("一、立項背景、目標與證據邊界"));
bodyChildren.push(h2("1.1 立項背景"));
bodyChildren.push(body("固定串併聯電池在面對高頻功率脈衝、模組老化差異與單點故障時，通常需要以超額配置、降額或備援容量維持服務。飛輪適合提供高功率與高循環緩衝，RAIBA 則提供模組旁路、拓撲調整與健康度管理。兩者結合有機會同時降低電池應力與備援需求，但也把開關暫態、保護、量測與多變流器控制耦合到同一個系統中。"));
bodyChildren.push(body("因此，本計畫的技術問題不是簡單增加一個儲能元件，而是建立一套能在正常、重構、診斷與故障四種模式下維持安全與服務連續性的控制與驗證方法。"));
bodyChildren.push(h2("1.2 研究目標"));
bodyChildren.push(numbered("建立含 RAIBA 開關矩陣、飛輪機電系統、選擇性雙向 DC/DC 與 PCS 的可驗證模型。"));
bodyChildren.push(numbered("提出重構期間的功率掩護、主動阻尼、湧流抑制及故障隔離方法。"));
bodyChildren.push(numbered("建立服務不間斷的多電芯 EIS 量測與 SOH 估計流程，並將結果回授功率與拓撲決策。"));
bodyChildren.push(numbered("以安全交付能量、全壽命可用率及 LCOS 判斷技術是否具有實際工程價值。"));
bodyChildren.push(h2("1.3 證據分類"));
bodyChildren.push(table(["標籤","本報告中的意義","使用限制"],[["【論文－實測】","論文提供硬體、原型或實驗量測","只適用於其原型、測試條件與負載，不外推為通用性能"],["【論文－模擬】","結果由等值模型、最佳化或仿真得到","需註明模型、資料與假設，不能視為工程實績"],["【工程事實】","政府、研究機構或業主確認已投運、併網或驗收","可作為技術成熟度與 benchmark，但仍需注意量測邊界"],["【企業宣稱】","產品型錄、企業新聞稿或供應商性能說明","不能當作第三方驗證；合作前須索取原始測試"],["【立項建議】","本報告提出的架構、方法、KPI、Gate 與停止條件","全部為待驗證目標，不得包裝成現有成果"]],[1700,3500,4160]));
bodyChildren.push(h2("1.4 研究範圍與資料限制"));
bodyChildren.push(bullet("學術檢索聚焦 flywheel–battery HESS、reconfigurable battery／DRBN、RAIBA、online EIS、DC-link stability、fault ride-through、grid-forming 及 HIL。"));
bodyChildren.push(bullet("產業資料以官方、政府、研究機構、企業技術頁與公司主體資料庫交叉辨識；公司資料庫只用於主體與存續線索，不用於證明產品性能。"));
bodyChildren.push(bullet("使用者指定的 RAIBA GitHub 倉庫中，本輪實際可檢閱的是 README；部分架構、歷史與 MVP 文件未能公開取得，因此不把其未取得的規格當成已驗證事實。"));
bodyChildren.push(bullet("本報告不是完整專利 FTO 法律意見，也不是特定場域的電網認證計畫；正式商業化前仍需專利、標準與安規專案。"));

bodyChildren.push(h1("二、技術基線：RAIBA 與飛輪的互補關係"));
bodyChildren.push(h2("2.1 RAIBA 的技術起點"));
bodyChildren.push(cited("【論文－實測】RAIBA 原始 USENIX ATC 2018 論文由工研院團隊提出，重點是運轉中改變電池互連，以處理退役與異質電池差異。其完整原型在特定真實負載 trace 下放電服務時間提升超過 80%；此結果只適用於該原型與測試條件。",1));
bodyChildren.push(cited("【技術供方資料】工研院技轉頁將 RAIBA 歸納為異質電池相容、零備援容錯、線上恆電流切換、即時重組與 EIS 應用；公開規格包含 kWh 級 α prototype 與 20V／10A 切換模組。頁面所述容量與壽命改善比例仍須以原始測試報告確認。",2));
bodyChildren.push(body("在本計畫中，RAIBA 被視為四種能力的組合：模組功率路由、串併聯與旁路拓撲、故障隔離，以及診斷驅動的健康度管理。它不是單純的電池能量來源，也不是只要增加開關就能自然獲得可靠度；開關失效、切換順序、量測與保護必須一併設計。"));
bodyChildren.push(h2("2.2 飛輪的合理角色"));
bodyChildren.push(body("飛輪的主要優勢是快速雙向功率、高循環與可預測的機電能量狀態；主要限制是可用能量、自放電、待機損耗、真空與軸承系統，以及故障時的安全處置。它適合做功率型緩衝，不應在缺乏應用數據時被預設為小時級電池的替代品。"));
bodyChildren.push(table(["功能","傳統飛輪—電池 HESS","加入 RAIBA 後應新增的研究"],[["功率分工","飛輪高頻、電池低頻；飛輪 SOC 自恢復","依模組 SOH、溫度與故障風險決定哪些模組承擔功率"],["電池保護","降低峰值電流與微循環","重構、旁路與輪替須同時滿足開關 SOA 與老化均勻化"],["服務連續性","依賴變流器與備援容量","由飛輪覆蓋模組隔離與拓撲重建期間的功率缺口"],["診斷","通常在固定電池拓撲上執行","在飛輪掩護下改變電池工作點，取得較佳激勵並回授控制"]],[1600,3500,4260]));
bodyChildren.push(h2("2.3 四種運轉模式"));
bodyChildren.push(...figure("fig2_modes.png",620,349,"圖 1｜本計畫的四種運轉模式與主要驗收面向（立項建議）。"));
bodyChildren.push(body("正常模式證明基本效率與功率分工；重構模式證明開關與母線安全；診斷模式證明服務不間斷量測；故障模式證明隔離、橋接與降額恢復。四者必須共用同一套健康度、功率與保護狀態，避免各功能各自為政。"));

bodyChildren.push(h1("三、學術前案、直接競爭文獻與查新修正"));
bodyChildren.push(h2("3.1 可重構電池研究基線"));
bodyChildren.push(cited("Ci、Lin、Wu 於 2016 年系統整理可重構電池拓撲、控制與系統設計，代表 RBS 已是成熟研究領域，不能把「動態重構電池」本身當作新穎主貢獻。",3));
bodyChildren.push(cited("Han 等於 2020 年將動態重構列為下一代 BMS 核心方向，討論硬體設計、管理原則、故障隔離、均衡與最佳化，並明確指出開關數量、成本與控制複雜度之間的取捨。",4));
bodyChildren.push(h2("3.2 飛輪—電池共直流母線已有實測"));
bodyChildren.push(cited("【論文－實測】Hu 與 Liaw 於 IFEEC 2013 建立風機 DC 微電網中的飛輪／電池混合儲能：電池經半橋雙向 DC/DC，PMSM 飛輪經雙向三相逆變器接至 DC bus，並提供實測。故「共 DC-link＋飛輪＋電池」本身不是新架構。",5));
bodyChildren.push(h2("3.3 RBS 線上 EIS 的直接前案"));
bodyChildren.push(cited("Kersten 等於 IECON 2020 提出在可重構電池或多階逆變器中，對電芯、模組或電池包進行線上阻抗估計，因此不能主張首次以 RBS 做線上阻抗量測。",6));
bodyChildren.push(cited("【論文－實測】Chen 等於 2024 年以多重正弦 PWM 在一般充放電中調制電流，16 顆電池原型不需額外可程式電源即可執行線上 EIS，故「無額外激勵源做 EIS」已有直接前案。",7));
bodyChildren.push(cited("【論文－實測】Peng 等於 IEEE TPEL 2026 進一步利用 RBS 切換暫態同步萃取電芯阻抗，並以能量導向 S-Transform 強化高頻取得。其研究顯示切換暫態本身也已被用於診斷。",8));
bodyChildren.push(h2("3.4 最重要的直接組合前案：FESS＋DRBN"));
bodyChildren.push(cited("【論文－模擬／預印本】Paizulamu 等於 2026 年提出全時間尺度階層 MPC-MTIP，模型同時納入 FESS、DRBN、CAES 與氫—甲醇儲能。其特定工業微電網資料與模擬報告 97.4% 淨負載平抑率及 62.2% 綜合循環效率。",9));
bodyChildren.push(callout("查新修正","調度層已存在「飛輪＋動態可重構電池」直接前案。可主張的研究缺口應收斂到該文未覆蓋的開關暫態、單體／模組重構、共 DC-link 阻抗、故障橋接、EIS 量測品質與 PHIL／HIL，而非宣稱組合本身從未出現。"));
bodyChildren.push(h2("3.5 功率分配與容量最佳化已相當擁擠"));
bodyChildren.push(cited("【論文－模擬】Wen 等於 2025 年以 ICEEMDAN、低通濾波與 PSO 做飛輪—電池容量最佳化；在 10 MW 風電＋10 MW 太陽能的特定模擬中，1 分鐘最大波動率為 3.2%，成本較單一電池低 45.1%。這些數字不是通用實績。",10));
bodyChildren.push(cited("2026 年相關應用論文亦明確比較共 AC 與共 DC 架構：共 AC 較容易隔離個別儲能單元故障；共 DC 可由機側變流器抑制母線波動，但提高併網逆變器與全系統故障處理複雜度。",11));
bodyChildren.push(h2("3.6 文獻對照總表"));
bodyChildren.push(table(["文獻","已完成內容","證據類型","對本計畫的邊界"],[["Ci et al., 2016","RBS 拓撲、控制與系統綜述","綜述","重構電池不是新領域"],["Han et al., 2020","下一代 BMS 動態重構、管理原則與最佳化","綜述","需解決開關、成本與控制複雜度"],["Hu & Liaw, 2013","飛輪／電池共 DC-bus 與實測","實測","共 DC 架構不是新穎點"],["Kersten et al., 2020","RBS／多階逆變器線上阻抗估計","方法＋驗證","不可主張首次 RBS-EIS"],["Chen et al., 2024","16 芯 MSPWM 線上 EIS，無額外可程式電源","實測","無額外激勵源不是首創"],["Peng et al., 2026","以切換暫態同步萃取阻抗","實測","暫態診斷已有前案"],["Paizulamu et al., 2026","FESS＋DRBN 全時間尺度階層 MPC","模擬／預印本","調度層直接前案；硬體層仍有缺口"],["Wen et al., 2025","HESS 功率分配與容量最佳化","模擬","不宜作為主創新"]],[1850,3150,1450,2910],{fontSize:17}));
bodyChildren.push(h2("3.7 可防守的新穎性表述"));
bodyChildren.push(callout("建議用語","在本輪公開檢索範圍內，尚未見一套同時完成「RAIBA 開關級重構暫態、飛輪即時故障功率橋接、服務不間斷高品質 EIS，以及診斷結果即時回授拓撲選擇」的完整實驗系統。此表述仍需在正式申請前補做專利檢索與 FTO。"));
bodyChildren.push(h2("3.8 立項書禁止出現的過度宣稱"));
bodyChildren.push(bullet("全球首次結合飛輪與可重構電池。"));
bodyChildren.push(bullet("首次利用可重構電池在無額外電源下執行 EIS。"));
bodyChildren.push(bullet("飛輪降低電池高頻電流或延長壽命本身就是核心創新。"));
bodyChildren.push(bullet("重構提高效率或容錯本身就是核心創新。"));

bodyChildren.push(h1("四、系統架構選擇與建議主攻拓撲"));
bodyChildren.push(h2("4.1 架構比較"));
bodyChildren.push(table(["架構","優點","主要風險／成本","建議角色"],[["A：AC 耦合或固定 DC-link，雙方各有變流器","故障邊界清楚、改造快、容易建立基線","轉換級較多；只做功率分流時新穎性不足","12 個月 MVP 與對照組；先完成 EIS、故障橋接與健康度控制"],["B：共 DC-link＋選擇性雙向 DC/DC＋RAIBA","可研究功率路由、重構暫態、阻抗耦合與診斷激勵","重構造成電壓缺口、湧流、環流與控制交互作用","主計畫核心；保留必要調壓與保護"],["B2：可變 DC-link，RAIBA 離散電壓直接追蹤","有機會減少電池側主功率轉換級","離散電壓階躍、轉速耦合、PCS 調製、預充與保護複雜","高風險子題；先模型與低功率驗證，不列必成"],["C：多埠／MMC／TAB／MAB","模組化、隔離與中壓擴展性佳","磁件、控制、保護、成本與認證最複雜","2–3 年後的 MW 級長期路線"]],[1700,2700,2800,2160],{fontSize:17}));
bodyChildren.push(h2("4.2 建議主攻架構"));
bodyChildren.push(...figure("fig1_architecture.png",620,349,"圖 2｜建議主攻之共直流母線＋選擇性雙向 DC/DC＋RAIBA 架構（立項建議）。"));
bodyChildren.push(body("輸入為電網／負載功率需求、飛輪轉速與可用能量、電池模組 V／I／T／EIS／SOH，以及保護狀態；輸出為對外功率、模組功率命令、拓撲命令、故障隔離與降額狀態。成功條件不只是穩態效率，而是重構與故障時仍能維持安全與服務。"));
bodyChildren.push(h3("正常路徑"));
bodyChildren.push(body("EMS 依負載與飛輪 SOC 分配功率，RAIBA 依模組 SOH、溫度與內阻輪替模組，PCS 維持併網或構網控制。飛輪承擔高頻分量，電池避免承受不必要的高倍率脈衝。"));
bodyChildren.push(h3("例外路徑"));
bodyChildren.push(body("重構前，控制器先估計母線能量缺口並命令飛輪前饋補償；執行安全切換序列後，再重新收斂功率分配。若飛輪不可用或能量不足，系統應延後非必要重構，或直接降額，而不是強行維持額定輸出。"));
bodyChildren.push(h3("回退路徑"));
bodyChildren.push(body("架構 B 或 B2 未通過穩定與暫態 Gate 時，保留架構 A 的獨立變流器與固定 DC-link，仍可使用 RAIBA 的診斷、模組旁路及健康管理成果。B2 省轉換級的商業主張不得成為主計畫成功的必要條件。"));
bodyChildren.push(h2("4.3 主要設計取捨"));
bodyChildren.push(table(["設計選項","潛在收益","必須付出的代價"],[["保留電池側雙向 DC/DC","控制自由度高、故障隔離較清楚、重構範圍較容易管理","效率、成本與體積增加"],["直接耦合可變 DC-link","可能減少功率級與部分轉換損耗","離散電壓追蹤、預充、保護、EMI 與 PCS 工作範圍受限"],["提高 RAIBA 重構自由度","更多模組輪替、故障隔離與電壓組合","開關數、驅動、量測、認證組態與故障模式快速增加"],["增加在線 EIS 頻率","健康度資料更新快，可更精準調整功率","切換壽命、CPU／通訊負載、EMI 與服務品質風險增加"]],[2250,3370,3740]));

bodyChildren.push(h1("五、十二項研發議題池"));
bodyChildren.push(body("以下十二項議題依「主計畫必成、核心創新、放大驗證與高風險可停止」分層。立項時不宜把十二項平均分配資源；前五項與 HIL 應形成最小可驗證閉環。"));
bodyChildren.push(h2("議題 1｜共 DC-link 阻抗與小信號穩定性"));
bodyChildren.push(body("【核心問題】飛輪機側變流器、PCS、電池側 DC/DC 與 RAIBA 等效阻抗會隨轉速、功率與拓撲改變；傳統只看單機穩定性，無法保證整體母線穩定。"));
bodyChildren.push(bullet("研究內容：建立各拓撲下的阻抗／導納模型，分析控制頻寬交疊、LC 共振與負阻抗效應；提出主動阻尼與頻寬協調。"));
bodyChildren.push(bullet("輸入：母線電容、線路阻抗、各變流器控制參數、轉速與 RAIBA 組態；輸出：穩定域、阻尼命令與禁用工作區。"));
bodyChildren.push(bullet("驗證：阻抗掃描、階躍與參數掃描；HIL 與台架的關鍵暫態誤差目標＜10%。"));
bodyChildren.push(h2("議題 2｜重構暫態、湧流與環流抑制"));
bodyChildren.push(body("【核心問題】模組切出／切入會造成電壓階躍、母線缺口、預充電流與模組間環流；飛輪雖能補功率，但不能自動消除硬體暫態。"));
bodyChildren.push(bullet("研究內容：安全切換序列、先接後斷／先斷後接邊界、主動預充、飛輪前饋補償、切換 SOA 與軟切換策略。"));
bodyChildren.push(bullet("建議 KPI：湧流＜2 pu 且持續＜1 ms；DC-link 缺口＜5%、＜10 ms；PCS 側功率擾動＜2%。"));
bodyChildren.push(bullet("停止條件：若需要昂貴緩衝才能達標，須重新計算架構 B／B2 的成本合理性。"));
bodyChildren.push(h2("議題 3｜飛輪功率掩護下的服務不間斷 EIS"));
bodyChildren.push(body("【核心問題】既有 RBS-EIS 已可利用 PWM 或切換暫態，但在多電芯、共用串聯電流與不同步電壓取樣下，頻譜會互相污染；重構還可能影響對外服務。"));
bodyChildren.push(bullet("研究內容：比較 MSPWM、切換暫態與混合激勵；飛輪吸收激勵功率；建立電壓／電流時間戳校正、頻率交疊解混與雜訊加權估計。"));
bodyChildren.push(bullet("建議 KPI：中頻幅值誤差＜5%、低頻＜10%；量測＜60 s；量測期間對外功率滿足服務約束。"));
bodyChildren.push(bullet("停止條件：在實測雜訊、同步誤差與多電芯條件下，中頻誤差仍＞10%，停止高頻在線 EIS，改為低頻率診斷。"));
bodyChildren.push(h2("議題 4｜EIS／SOH 驅動診斷—重構閉環"));
bodyChildren.push(body("【核心問題】EIS 若只產生報表，不能證明 RAIBA 的價值；必須把內阻、SOH、溫度與不確定性轉成功率限制、模組輪替及拓撲選擇。"));
bodyChildren.push(bullet("研究內容：SOH 與風險估計、健康度加權功率分配、模組可用性預測、重構收益／代價評分，以及估計錯誤時的保守策略。"));
bodyChildren.push(bullet("輸入：EIS、SOH、溫度、SOC、故障機率與開關壽命；輸出：模組功率上下限、禁用模組、拓撲與重構時機。"));
bodyChildren.push(bullet("驗收重點：不只比 SOH 估計誤差，還要比較安全交付能量、溫升、老化離散度與可用率。"));
bodyChildren.push(h2("議題 5｜模組故障隔離與飛輪功率橋接"));
bodyChildren.push(body("【核心問題】故障偵測、隔離、拓撲重建與功率恢復各有延遲；飛輪能量有限，不能無條件宣稱零中斷。"));
bodyChildren.push(bullet("研究內容：短路／開路／過溫／通訊失效辨識、選擇性隔離、最小可行拓撲、飛輪橋接能量計算與降額恢復。"));
bodyChildren.push(bullet("建議 KPI：單模組失效後對外輸出跌落＜5%；在能量允許時完成橋接，否則安全降額；不得擴大故障。"));
bodyChildren.push(h2("議題 6｜即時 HIL／PHIL 與故障注入"));
bodyChildren.push(body("【核心問題】真實台架難以安全覆蓋大量開關、感測器與直流故障；只用離線模擬又無法驗證控制器時間行為。"));
bodyChildren.push(bullet("研究內容：即時電池／飛輪／變流器模型、控制器 HIL、功率硬體在環、時間同步、故障腳本與自動回歸。"));
bodyChildren.push(bullet("建議 KPI：至少 50 個故障案例；HIL 與台架關鍵暫態誤差＜10%；每次軟韌體更新可重跑安全案例。"));
bodyChildren.push(h2("議題 7｜重構期間構網與虛擬慣量連續性"));
bodyChildren.push(body("【放大驗證】若 PCS 採構網控制，重構與飛輪功率前饋會改變等效慣量、阻尼與功率限制，可能與 DC-link 控制互相干擾。"));
bodyChildren.push(bullet("研究內容：構網／跟網切換、虛擬慣量與飛輪真實慣量的協調、重構期間相角與頻率支撐，以及弱電網穩定性。"));
bodyChildren.push(bullet("邊界：不把飛輪機械慣量直接等同於對電網可用的虛擬慣量；必須受變流器、轉速與保護限制。"));
bodyChildren.push(h2("議題 8｜多時間尺度 EMS 與飛輪 SOC 自恢復"));
bodyChildren.push(body("【基礎必要功能】飛輪若長期停在滿或空狀態，就無法在重構或故障時提供雙向掩護；EMS 必須保留可用能量餘量。"));
bodyChildren.push(bullet("研究內容：毫秒級功率控制、秒級重構與診斷排程、分鐘級 SOC 自恢復，以及日級老化與成本最佳化。"));
bodyChildren.push(bullet("建議 KPI：上層 EMS 單步＜10 ms；即時安全控制仍須在更快的本地迴路完成，不得依賴雲端。"));
bodyChildren.push(h2("議題 9｜異質／退役電池不對稱老化管理"));
bodyChildren.push(body("【RAIBA 差異化主場】不同容量、內阻與老化路徑的模組不能只用平均 SOH 管理；重構應降低弱模組應力，同時避免把好模組過度使用。"));
bodyChildren.push(bullet("研究內容：異質模組可行拓撲、溫度與老化離散度約束、模組輪替公平性、退役電池篩選與不確定性管理。"));
bodyChildren.push(bullet("驗證：至少使用兩種以上老化狀態模組，不能只用全新同批電池宣稱異質管理能力。"));
bodyChildren.push(h2("議題 10｜可變母線下 PMSM 弱磁、調製、共模與軸承電流"));
bodyChildren.push(body("【B2 專屬高風險】DC-link 隨 RAIBA 離散變化時，飛輪 PMSM 的有效電壓裕量、弱磁區、調製比與共模電壓都會改變。"));
bodyChildren.push(bullet("研究內容：轉速—母線電壓可行域、弱磁與過調製邊界、共模／軸承電流、功率模組應力與濾波器設計。"));
bodyChildren.push(bullet("停止邊界：若電壓階躍使飛輪可用轉速區過窄，或新增磁性元件與濾波成本過高，不進入高功率原型。"));
bodyChildren.push(h2("議題 11｜DC 短路保護、選擇性與認證組態"));
bodyChildren.push(body("【安全必成】RAIBA 可改變故障電流路徑，傳統固定拓撲保護定值未必適用；保護必須知道目前開關組態與允許操作序列。"));
bodyChildren.push(bullet("研究內容：故障電流方向與能量來源、熔絲／接觸器／半導體保護協調、直流弧、選擇性隔離與失效安全狀態。"));
bodyChildren.push(bullet("認證策略：限制可重構組態集合，建立組態—保護定值—測試案例的一對一證據，避免無限組態造成無法驗證。"));
bodyChildren.push(h2("議題 12｜LCOS、開關網成本、損耗與可靠度共同設計"));
bodyChildren.push(body("【商業化必要】技術增益必須扣除飛輪待機損耗、RAIBA 開關導通與驅動損耗、DC/DC、濾波器、感測器、控制器與維護成本。"));
bodyChildren.push(bullet("研究內容：建立效率地圖、開關壽命與失效模型、備援與維修成本、可用率、折舊及殘值；比較固定電池、傳統 HESS 與 DRBN。"));
bodyChildren.push(bullet("建議 Gate：架構 B 全工況淨效率增益目標≥1.5%；若 LCOS＞傳統 HESS 的 1.05 倍且沒有應用價值可翻正，停止商業化線。"));

bodyChildren.push(h1("六、三條核心技術主軸與實驗方法"));
bodyChildren.push(h2("6.1 主軸一：重構暫態穩定與主動阻尼"));
bodyChildren.push(body("建立從元件到系統的模型層級：開關與預充電路、母線與線路阻抗、變流器平均與開關模型、飛輪機電模型，以及 RAIBA 拓撲狀態機。先以阻抗分析辨識不穩定區，再以飛輪功率前饋、母線電壓回授與主動阻尼降低暫態。"));
bodyChildren.push(body("關鍵不是追求所有組態都能任意切換，而是找出可認證、可穩定且可降額的有限組態集合。對不穩定或能量不足的組態，控制器應禁止進入。"));
bodyChildren.push(h2("6.2 主軸二：故障隔離與功率橋接"));
bodyChildren.push(...figure("fig3_fault_bridge.png",620,349,"圖 3｜故障偵測、隔離、飛輪橋接與降額恢復時序（立項建議）。"));
bodyChildren.push(body("實驗需記錄每個階段的時間戳、飛輪可用能量、母線電壓、對外功率與故障電流，並區分「偵測不到」「隔離失敗」「能量不足」及「控制不收斂」四種失敗原因。成功判準應包含不擴大故障與可恢復，而不是只看一次示波器波形。"));
bodyChildren.push(h2("6.3 主軸三：飛輪掩護 EIS 與診斷驅動重構"));
bodyChildren.push(...figure("fig4_eis_loop.png",620,349,"圖 4｜服務不間斷 EIS 與診斷驅動重構閉環（立項建議）。"));
bodyChildren.push(body("三種量測模式需在同一硬體上比較：MSPWM 型激勵、RAIBA 切換暫態激勵，以及混合模式。控制組包含無飛輪、不同步取樣、不同雜訊與不同負載，藉此辨識真正改善來源。"));
bodyChildren.push(h3("時間同步與資料品質"));
bodyChildren.push(bullet("串聯電流與單模組電壓必須使用共同時間基準；報告需列出取樣率、時間偏差、濾波器相位與插值方法。"));
bodyChildren.push(bullet("多模組激勵需避免頻率碰撞；若採頻分或碼分，需驗證在非線性與溫度漂移下是否仍可分離。"));
bodyChildren.push(bullet("EIS 結果需與參考儀器或離線量測比對，並標示頻段、SOC、溫度、電流振幅與置信區間。"));
bodyChildren.push(h2("6.4 2×2 對照是必要設計"));
bodyChildren.push(...figure("fig5_experiment_matrix.png",620,349,"圖 5｜B0–B3 的 2×2 對照與交互綜效計算（立項建議）。"));
bodyChildren.push(body("若只比較 B0 與 B3，會把飛輪、RAIBA 與控制演算法的貢獻混在一起。交互綜效可定義為 Δinteraction＝Y(B3)－Y(B2)－Y(B1)＋Y(B0)，其中 Y 可為安全交付能量、效率、峰值電流、可用率或 LCOS。必須以重複實驗與不確定性判斷是否顯著。"));
bodyChildren.push(h2("6.5 量測與資料規格"));
bodyChildren.push(table(["資料","最低需求","用途"],[["電氣波形","母線與模組電壓、串聯／分支電流、對外功率；共同時間戳","暫態、EIS、效率與保護分析"],["飛輪狀態","轉速、功率、機側電流、溫度、真空／軸承告警","能量餘量、橋接能力與安全邊界"],["電池狀態","模組 SOC、SOH、溫度、EIS、故障與旁路狀態","健康度控制與異質老化驗證"],["控制事件","拓撲命令、實際開關回授、控制器模式、保護定值","因果分析、故障復現與認證證據"],["負載／電網","真實 trace、功率品質、頻率事件與環境條件","場域代表性與 LCOS 計算"]],[1600,4550,3210]));

bodyChildren.push(h1("七、12 個月 MVP 與驗收設計"));
bodyChildren.push(h2("7.1 MVP 範圍"));
bodyChildren.push(body("建議以約 10–30 kW 等效台架為起點，實際功率依現有飛輪、電池模組、變流器與實驗室安全條件調整。MVP 不以 MW 放大或省掉 DC/DC 為目標，而是建立可信量測、四組對照、重構暫態、故障橋接與 EIS 閉環。"));
bodyChildren.push(h2("7.2 分階段工作"));
bodyChildren.push(table(["階段","主要工作","交付物","Gate"],[["M0–M2","需求、場域 trace、B0–B3 定義、同步量測與安全審查","需求規格、資料字典、量測不確定性、測試計畫","G1：量測可信度；時間同步與參考儀器比對通過"],["M3–M5","架構 A 台架、架構 B 開關級 HIL、功率分配與 SOC 自恢復","可運轉台架、即時模型、B0／B1 基線","基本效率與安全功能可重複"],["M6–M8","重構暫態、主動阻尼、三種 EIS 模式、SOH 回授","暫態控制、EIS 演算法、B2／B3 結果","G2：暫態與 EIS 雙門檻"],["M9–M12","故障注入、PHIL 選配、效率、可靠度與 LCOS","≥50 故障案例、效率地圖、LCOS、放大建議","G3：是否進入 50–100 kW 工程驗證"]],[1250,3050,3000,2060],{fontSize:17}));
bodyChildren.push(h2("7.3 KPI 總表"));
bodyChildren.push(table(["面向","12 個月建議目標【立項建議】","量測條件"],[["重構暫態","湧流＜2 pu、＜1 ms；DC-link 缺口＜5%、＜10 ms","最不利電壓差、SOC、負載與允許拓撲"],["對外服務","PCS 側功率擾動＜2%；單模組失效輸出跌落＜5%","飛輪能量足夠與不足兩種條件分開報告"],["高頻電流","電池＞0.1 Hz 高頻電流相對無飛輪基線衰減≥20 dB","同一負載 trace、同一頻譜與窗函數"],["EIS","中頻幅值誤差＜5%、低頻＜10%；量測＜60 s","指定 SOC／溫度／電流；參考儀器比對"],["即時控制","EMS 單步＜10 ms；本地保護不依賴上層","標示 CPU、通訊與最壞執行時間"],["HIL","關鍵暫態誤差＜10%；故障案例≥50","同一事件與時間戳比對"],["效率","架構 B 淨效率增益目標≥1.5%","含待機、開關、變流器與輔助功耗"]],[1500,4350,3510],{fontSize:17}));
bodyChildren.push(h2("7.4 Gate 決策"));
bodyChildren.push(bullet("G1 未通過：不得進入性能比較，先修正時間同步、感測器、校準與資料管線。"));
bodyChildren.push(bullet("G2 暫態通過、EIS 失敗：保留重構與故障主線，EIS 改為低頻率或離線診斷。"));
bodyChildren.push(bullet("G2 暫態失敗、EIS 通過：退守架構 A，不在共 DC-link 高風險架構繼續擴大。"));
bodyChildren.push(bullet("兩者同時失敗：退守「架構 A＋RAIBA 診斷與健康管理」，不進入高功率原型。"));

bodyChildren.push(h1("八、2–3 年研發路線與放大條件"));
bodyChildren.push(...figure("fig6_roadmap.png",620,349,"圖 6｜12 個月 MVP 與第 2／3 年放大路線（立項建議）。"));
bodyChildren.push(h2("第 2 年：50–100 kW 工程驗證"));
bodyChildren.push(bullet("前提：G2、G3 通過，且至少有明確場域、負載 trace、合作設備與安全測試條件。"));
bodyChildren.push(bullet("重點：真實功率元件、熱設計、EMI、保護選擇性、長時間運轉、故障回歸與維護流程。"));
bodyChildren.push(bullet("輸出：工程規格、有限可認證組態、可靠度資料、效率地圖、場域 LCOS 與第三方測試計畫。"));
bodyChildren.push(h2("第 3 年：100 kW–MW 示範"));
bodyChildren.push(bullet("不是必然放大；只有當應用價值、設備供應、場域與安全認證都成立時才執行。"));
bodyChildren.push(bullet("若進入中壓或 MW，才評估 MMC／多埠／TAB／MAB；不得把小功率架構直接等比例外推。"));
bodyChildren.push(bullet("示範成功判準：安全交付能量、可用率、功率品質、故障恢復、維護與 LCOS，而非單一效率或單次波形。"));
bodyChildren.push(h2("放大前必答問題"));
bodyChildren.push(numbered("B3 相對 B1、B2 的交互綜效是否顯著且對模型誤差穩健？"));
bodyChildren.push(numbered("新增開關、感測器與控制器的故障率是否吃掉容錯收益？"));
bodyChildren.push(numbered("飛輪容量是否依真實故障與重構時間設計，而非只用額定功率匹配？"));
bodyChildren.push(numbered("有限拓撲組態能否完成保護、安規與併網驗證？"));
bodyChildren.push(numbered("DRBN 成熟工程方案是否已能以更低成本滿足同一需求？"));

bodyChildren.push(h1("九、全球、中國與台灣產業對標"));
bodyChildren.push(h2("9.1 全球：飛輪不是單一產品形態"));
bodyChildren.push(cited("【工程事實】美國 DOE Hazle Spindle 報告記錄 Beacon Power Hazle Township 電站配置 200 台 100 kW／25 kWh 飛輪，合計 20 MW／5 MWh，屬短時高功率調頻型工程。",12));
bodyChildren.push(...figure("beacon_hazle.png",620,198,"圖 7｜Beacon Power Hazle Township 飛輪電站。資料來源：Beacon Power 官方圖像，僅作工程案例辨識。"));
bodyChildren.push(cited("【企業資料表】Amber Kinetics M32 資料表列 8 kW／32 kWh、4 小時放電、DC 來回效率＞86% 與 30 年設計壽命，代表長時飛輪路線；這些是供應商資料，需以第三方測試確認。",13));
bodyChildren.push(cited("【工程案例／企業發布】Leclanché 與 S4 Energy 的 Almelo 案結合 8.8 MW／7.12 MWh 電池與六台合計 3 MW 飛輪，提供 9 MW FCR，是飛輪功率與電池能量分工的直接工程案例。",14));
bodyChildren.push(...figure("s4_almelo.png",620,414,"圖 8｜S4 Energy／Leclanché Almelo 飛輪—電池混合儲能現場。資料來源：企業官方案例圖像。"));
bodyChildren.push(cited("【企業宣稱】Active Power CLEANSOURCE PLUS SMS 代表飛輪 UPS 產品路線，其價值主張集中在高功率、短時橋接、減少電池維護與資料中心可用性。合作或採購時仍需取得特定機種的效率、橋接時間與認證資料。",15));
bodyChildren.push(h2("9.2 中國：混合儲能與 DRBN 都已有大型工程"));
bodyChildren.push(cited("【工程事實】山西省政府資料顯示芮城獨立儲能項目為 100 MW／50.41 MWh，其中飛輪 50 MW／0.41 MWh、磷酸鐵鋰 50 MW／50 MWh。此配置清楚呈現功率型與能量型資產分工。",17));
bodyChildren.push(cited("【工程事實／校方發布】清華大學 2026 年公布百兆瓦級動態可重構電池儲能示範驗收資料：2025 年 1 月投運、相容 5 種模組，電池簇直流側效率 94.84%、系統綜合效率 84.06%、可用係數 99.3%。本計畫不能只對標固定串併聯電池，必須直接比較此類成熟 DRBN 工程。",16));
bodyChildren.push(callout("對標結論","飛輪＋電池與 DRBN 各自都已進入大型工程。RAIBA×飛輪的價值必須來自更細的重構暫態、故障隔離、診斷品質與可用率證據，不能只以「混合儲能」或「動態重構」作為差異化。"));
bodyChildren.push(h2("9.3 台灣：中壓 UPS 與關鍵電力是重要對標"));
bodyChildren.push(cited("【企業宣稱】台達與泓慧能源於 2026 年發布 SST＋飛輪儲能 10 kV 中壓 UPS，企業資料列 1–24 MW 產品範圍。效率與相關性能須明確標示為企業宣稱，不能替代第三方驗證。",18));
bodyChildren.push(body("對本計畫而言，此案例的重要性不在於直接複製中壓 UPS，而是證明台灣市場已重視飛輪、功率電子與關鍵負載整合。RAIBA 若要進入此場域，需回答電池長時備電、模組維修、故障隔離與認證組態，而不是只做小型實驗波形。"));
bodyChildren.push(h2("9.4 產業對標總表"));
bodyChildren.push(table(["案例","公開規格／事實","對本計畫的意義","證據限制"],[["Beacon Hazle","200×100 kW／25 kWh；20 MW／5 MWh","高功率調頻基線","DOE 工程報告；非 RAIBA"],["Amber M32","8 kW／32 kWh、4 h、DC RTE＞86%","長時飛輪與不同應用邊界","企業資料表，需第三方驗證"],["S4／Leclanché Almelo","8.8 MW／7.12 MWh 電池＋3 MW 飛輪；9 MW FCR","功率／能量分工的混合工程","企業案例發布"],["芮城","50 MW／0.41 MWh 飛輪＋50 MW／50 MWh LFP","大型混合儲能配置 benchmark","政府併網資料"],["清華慈松 DRBN","5 種模組；94.84%／84.06%；可用係數 99.3%","RAIBA 必須直接對標的 DRBN 工程","校方驗收發布；需理解量測邊界"],["台達×泓慧","SST＋飛輪 10 kV 中壓 UPS；1–24 MW","關鍵電力與台灣供應鏈","企業新聞稿，性能屬企業宣稱"]],[1750,2850,2750,2010],{fontSize:17}));

bodyChildren.push(h1("十、應用選擇、合作對象與競品關係"));
bodyChildren.push(h2("10.1 應用優先級"));
bodyChildren.push(table(["優先級","應用","為何適合","必要驗證"],[["1","AIDC、半導體與關鍵製程電力","同時重視瞬時功率、服務連續性、模組維修與長時備電；RAIBA 容錯與診斷較有價值","真實負載與停機成本、UPS／PCS 介面、備電時間、安規與維修流程"],["2","工業微電網、弱電網快充","高功率脈衝與電網限制並存，飛輪可緩衝，RAIBA 可管理異質模組","電網容量、需量電費、充電曲線、構網需求與場域安全"],["3","調頻、風光平抑","既有工程與商業模式較清楚，適合成果落地","與成熟 HESS 比較 LCOS；不能作為主要新穎性"],["觀察","長時儲能與一般能量套利","飛輪未必有成本優勢，RAIBA 價值取決於退役／異質電池來源","電池來源、循環策略、待機損耗與全壽命成本"]],[900,2100,3450,2910],{fontSize:17}));
bodyChildren.push(h2("10.2 建議合作對象與角色"));
bodyChildren.push(table(["對象類型","優先洽談內容","本計畫需要的資料／資源"],[["工研院／RAIBA 技術團隊","背景 IP、技轉、原型與歷史測試邊界","開關模組、切換序列、EIS 方法、原始測試、可授權範圍"],["飛輪供應商","機電模型、變流器介面、功率／能量與安全資料","全轉速效率、SOC 定義、自放電、待機、故障模式、通訊與認證"],["清華慈松／DRBN 生態系","成熟 DRBN 工程對標與差異化","組態、效率量測、可用率定義、保護與運維資料；以公開或可授權資料為限"],["台灣 UPS／PCS／SST 團隊","關鍵電力系統整合與中長期工程化","負載規範、併網／UPS 介面、保護、安規與場域驗證"],["學術實驗室","阻抗穩定、EIS、故障診斷、HIL 與控制理論","即時模擬、阻抗量測、功率台架、故障注入與論文驗證能力"],["場域業主","真實需求與價值量化","匿名負載 trace、停機成本、維護限制、備援策略與驗收方式"]],[1850,3150,4360]));
bodyChildren.push(h2("10.3 競品與替代方案"));
bodyChildren.push(bullet("固定串併聯電池＋飛輪：結構較簡單，若已能滿足功率與可用率，RAIBA 的額外開關成本未必合理。"));
bodyChildren.push(bullet("DRBN＋傳統 PCS：已有大型工程，效率與可用率資料更成熟；本計畫必須證明飛輪掩護與診斷閉環的增量價值。"));
bodyChildren.push(bullet("飛輪 UPS＋獨立電池備電：故障邊界清楚、認證較容易；RAIBA 需在長時備電模組維修與異質管理上勝出。"));
bodyChildren.push(bullet("超電容或其他功率型儲能：在極短時脈衝可能更適合；需以時間尺度、效率、壽命與成本比較，不預設飛輪唯一。"));
bodyChildren.push(h2("10.4 合作前的商業判準"));
bodyChildren.push(body("合作備忘錄不應只寫「提供設備」，而應約定可公開／可授權資料、模型與介面、故障測試責任、原始數據所有權、改良 IP、發表審查與後續工程化權利。尤其 RAIBA 歷史資料與企業文件需先確認公開授權，不能因技術合作就自動視為可公開。"));

bodyChildren.push(h1("十一、風險、停止條件、智慧財產與資料需求"));
bodyChildren.push(h2("11.1 主要技術與商業風險"));
bodyChildren.push(table(["風險","早期訊號","緩解／退守"],[["重構暫態無法收斂","湧流、母線缺口或 PCS 擾動持續超標","縮小允許拓撲、增加預充／阻尼；必要時退守架構 A"],["EIS 資料不可信","不同負載或時間差下結果漂移，與參考儀器不一致","修正同步與估計；降低量測頻率，不硬做即時全頻譜"],["飛輪能量不足","故障或重構橋接時轉速快速觸底","重新定量容量、保留 SOC 餘量、提前降額；不得宣稱零中斷"],["開關網可靠度抵銷容錯","驅動、接觸器或通訊故障增加","元件降額、失效安全設計、簡化組態與自動故障回歸"],["效率優勢不成立","全工況與待機後增益＜1.5%","停止以省轉換級為主張，轉向診斷／可用率價值"],["LCOS 無競爭力","高於傳統 HESS 1.05 倍且無高價值場域","停止商業化線，保留研究與特定利基應用"],["認證組態爆炸","每種拓撲都需不同保護與測試","限定組態白名單，建立組態—保護—測試證據矩陣"]],[2100,3150,4110],{fontSize:17}));
bodyChildren.push(h2("11.2 Kill criteria"));
bodyChildren.push(numbered("B2 所需緩衝／預充成本超過省下 DC/DC 成本的 50%，停止 B2。"));
bodyChildren.push(numbered("架構 B 全工況淨效率增益＜1.5%，不得再以省轉換級為核心商業主張。"));
bodyChildren.push(numbered("實測雜訊下 EIS 中頻誤差仍＞10%，停止高頻在線 EIS。"));
bodyChildren.push(numbered("飛輪×重構交互綜效＜3%，且對模型誤差穩健，停止複雜延壽與協同宣稱。"));
bodyChildren.push(numbered("LCOS＞傳統 HESS 的 1.05 倍且沒有應用可翻正，停止商業化線。"));
bodyChildren.push(numbered("暫態與 EIS 兩個 Gate 同時失敗，退守架構 A＋RAIBA 診斷，不放大功率。"));
bodyChildren.push(h2("11.3 智慧財產與查新"));
bodyChildren.push(bullet("RAIBA 背景 IP：確認原始專利、技轉範圍、改良發明歸屬與可實施領域；本報告不假定可自由使用。"));
bodyChildren.push(bullet("新穎性檢索：除論文外，需補飛輪＋可重構電池、故障橋接、EIS 激勵與診斷回授的專利家族與法律狀態。"));
bodyChildren.push(bullet("避免重複申請：共 DC-link、功率分配、RBS-EIS 與切換暫態診斷已有前案，專利應聚焦具體控制序列、量測校正與安全機制。"));
bodyChildren.push(bullet("公開與保密：原始歷史資料若含企業機密標記，未確認授權前不得上傳公開倉庫或用於對外簡報。"));
bodyChildren.push(h2("11.4 歷史資料與公開倉庫邊界"));
bodyChildren.push(body("任何歷史 source code、schematic、presentation、email、report、test data 或 corporate artifact，在加入公開倉庫前，都必須明確確認已獲公開授權。歷史 3S2P／5S5P、約 75% 容量差異與 98% 利用率等數字，對外發表或供客戶使用前必須由原始資料重新驗證。"));
bodyChildren.push(h2("11.5 必收資料"));
bodyChildren.push(body("若缺少以下資料，立項只能維持研究假設，不能完成商業與安全評估：RAIBA 開關級電路與失效模式、飛輪全轉速模型與效率、真實負載 trace、模組異質老化資料、變流器控制與保護參數、場域停機成本、維護與備援現況，以及效率／可用率的量測邊界。"));

bodyChildren.push(h1("十二、立項工作包與最終建議"));
bodyChildren.push(h2("12.1 建議工作包"));
bodyChildren.push(table(["WP","工作內容","主要交付","責任角色"],[["WP1 系統與場域","需求、trace、架構 A／B、B0–B3、LCOS 邊界","系統需求、對照定義、場域價值模型","系統負責人＋場域"],["WP2 電氣與保護","RAIBA、DC-link、預充、保護與有限組態","電氣規格、安全序列、組態白名單","功率電子＋電池"],["WP3 控制與穩定","阻抗模型、主動阻尼、EMS、SOC 自恢復","穩定域、控制器與即時程式","控制＋飛輪"],["WP4 診斷與重構","EIS 激勵、同步、解混、SOH 與拓撲回授","EIS 演算法、健康度策略、驗證資料","診斷＋電池"],["WP5 HIL 與台架","即時模型、故障注入、台架與自動回歸","≥50 故障案例、暫態與效率報告","測試＋學研"],["WP6 IP 與工程化","專利、技轉、認證、供應鏈與維護","FTO 初稿、認證路線、放大決策","計畫管理＋法務／工程"]],[1050,3050,3150,2110],{fontSize:17}));
bodyChildren.push(h2("12.2 立項評分重點"));
bodyChildren.push(bullet("科學與技術價值：是否提出可證偽的暫態、故障橋接與診斷閉環問題，而非再做一个功率分配模擬。"));
bodyChildren.push(bullet("工程可行性：是否有真實飛輪、RAIBA 模組、變流器、HIL 與安全台架，以及可量測的輸入輸出。"));
bodyChildren.push(bullet("差異化：是否直接對標 FESS＋DRBN 前案、RBS-EIS 前案與成熟 DRBN 工程。"));
bodyChildren.push(bullet("商業合理性：是否以場域價值與 LCOS 判斷，而非只用效率或延壽的單一數字。"));
bodyChildren.push(bullet("可停止性：B2、EIS、效率與商業化是否有明確退守，不讓高風險子題綁架整體成果。"));
bodyChildren.push(h2("12.3 最終建議"));
bodyChildren.push(callout("有條件通過","建議核准 12 個月 MVP，主名稱採「飛輪功率掩護下之 RAIBA 可重構電池系統：重構暫態穩定、故障功率橋接與診斷驅動重構技術」。第一年的成功定義是建立可信對照與可重複證據，不是完成 MW 產品。只有 G2、G3 與場域條件同時成立，才進入 50–100 kW；第 3 年 MW 示範需另行決策。"));
bodyChildren.push(body("若立項資源不足以同時支持四組對照、同步量測與故障測試，應縮小研究範圍，而不是刪除對照或用模擬取代所有實證。最小可保留成果為：架構 A 的 RAIBA 診斷、模組故障隔離、健康度功率管理，以及可重複的資料與測試平台。"));

bodyChildren.push(h1("附錄 A：KPI 與 Kill criteria 總表"));
bodyChildren.push(table(["項目","目標／門檻【立項建議】","失敗處置"],[["量測可信度","共同時間基準；參考儀器比對；不確定性文件化","G1 不通過則停止性能比較"],["重構湧流","＜2 pu 且＜1 ms","增加預充／阻尼、限制組態；仍失敗則退守 A"],["DC-link 缺口","＜5%、＜10 ms","同上"],["PCS 功率擾動","＜2%","降低重構自由度或暫停非必要重構"],["故障服務","單模組失效輸出跌落＜5%；可降額","重新設計隔離與能量餘量；不得宣稱零中斷"],["高頻電流","＞0.1 Hz 分量相對無飛輪基線衰減≥20 dB","檢查飛輪控制與容量；不作延壽外推"],["EIS","中頻＜5%、低頻＜10%、＜60 s","中頻實測誤差＞10%則停止高頻在線 EIS"],["EMS","單步＜10 ms","簡化上層最佳化；安全保留本地迴路"],["HIL","暫態誤差＜10%；≥50 故障案例","模型校正後才可用於放大"],["效率","架構 B 淨增益目標≥1.5%","低於門檻不得主打省轉換級"],["交互綜效","建議至少 3%且對模型誤差穩健","＜3%停止複雜協同／延壽宣稱"],["LCOS","不高於傳統 HESS 1.05 倍，或場域價值足以翻正","否則停止商業化線"],["B2 成本","緩衝／預充不超過省下 DC/DC 成本 50%","超過即停止 B2"]],[1900,4300,3160],{fontSize:17}));
bodyChildren.push(note("所有數值均為立項建議門檻，需在 M0–M2 依設備、場域與安全規範正式凍結；不得當作現有性能。"));

bodyChildren.push(h1("附錄 B：立項前 RFI 資料清單"));
bodyChildren.push(h2("B.1 RAIBA／電池"));
bodyChildren.push(bullet("開關矩陣、模組電壓／電流、接觸器或半導體規格、驅動與失效安全狀態。"));
bodyChildren.push(bullet("允許拓撲、切換序列、重構時間、預充與保護定值；原始歷史測試與不確定性。"));
bodyChildren.push(bullet("電池模組容量、內阻、老化、溫度與故障資料；異質模組來源與篩選方法。"));
bodyChildren.push(bullet("EIS 演算法、激勵方式、取樣同步、參考儀器比對與計算資源。"));
bodyChildren.push(h2("B.2 飛輪與變流器"));
bodyChildren.push(bullet("額定／峰值功率、可用能量與轉速範圍、SOC 定義、自放電與待機功耗。"));
bodyChildren.push(bullet("全轉速效率地圖、PMSM 與機側變流器模型、控制頻寬、通訊延遲與故障模式。"));
bodyChildren.push(bullet("真空、軸承、振動、溫度與安全聯鎖；維護週期、備件與壽命資料。"));
bodyChildren.push(bullet("PCS／DC/DC 的電壓範圍、調製限制、保護、效率與併網／UPS 介面。"));
bodyChildren.push(h2("B.3 場域與商業"));
bodyChildren.push(bullet("至少數週至數月的匿名負載 trace、取樣率、極值、功率品質與停機事件。"));
bodyChildren.push(bullet("現有備援、維護、停機成本、電價／需量／輔助服務收益與驗收方式。"));
bodyChildren.push(bullet("安規、消防、併網、UPS 與場域施工限制；可接受降額與故障恢復時間。"));
bodyChildren.push(h2("B.4 法務與資料治理"));
bodyChildren.push(bullet("背景 IP、技轉與改良 IP、論文發表與公開審查流程。"));
bodyChildren.push(bullet("原始數據所有權、模型授權、企業機密分級、公開倉庫與對外簡報核准。"));

bodyChildren.push(h1("參考文獻與資料來源"));
bodyChildren.push(note("以下為本報告實際引用來源。論文數值依其實驗或模擬條件解讀；企業資料不作第三方驗證。網頁檢索截止 2026-11-23。"));
for (const [id,text] of Object.entries(src)) {
  const m = text.match(/(https?:\/\/\S+)$/);
  const children = [run(`[${id}] ${m?text.slice(0,m.index):text}`,{size:18})];
  if (m) children.push(new ExternalHyperlink({link:m[1],children:[run(m[1],{size:17,color:C.teal,underline:{}})]}));
  bodyChildren.push(para(children,{spacing:{after:100,line:250}}));
}
bodyChildren.push(h2("補充資料使用聲明"));
bodyChildren.push(body("使用者指定的 RAIBA GitHub 僅採用實際可檢閱 README；未取得文件不作推測。公司主體資料庫僅協助辨識企業與存續線索，不用於支持技術性能。本報告未將任何未授權歷史企業文件、程式、圖面或測試數據納入公開交付。"));

const doc = new Document({
  creator:"Kimi",
  title:"飛輪儲能 × RAIBA 可重構電池系統技術研發立項完整報告",
  description:"學術前案、產業工程、系統架構、十二項研發議題、KPI、MVP 與停止條件",
  features:{updateFields:true},
  numbering:{config:[
    {reference:"bullets",levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:360,hanging:240}}}}]},
    {reference:"numbers",levels:[{level:0,format:LevelFormat.DECIMAL,text:"%1.",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:360,hanging:240}}}}]},
  ]},
  footnotes,
  styles:{
    default:{document:{run:{font,size:22,color:C.ink},paragraph:{spacing:{after:140,line:320}}}},
    paragraphStyles:[1,2,3].map((level)=>({id:`TOC${level}`,name:`toc ${level}`,basedOn:"Normal",next:"Normal",quickFormat:true,run:{font,size:level===1?20:18,color:C.ink},paragraph:{spacing:{after:70,line:250}}})),
  },
  sections:[
    {properties:{titlePg:true,page:{margin:{top:900,right:900,bottom:900,left:900}}},children:cover},
    {properties:{page:{margin:{top:900,right:900,bottom:900,left:900}}},
      headers:{default:new Header({children:[para(run("飛輪儲能 × RAIBA｜技術研發立項完整報告",{size:17,color:C.gray}),{alignment:AlignmentType.RIGHT,spacing:{after:40}})]})},
      footers:{default:new Footer({children:[para(new TextRun({children:[PageNumber.CURRENT],font,size:18,color:C.gray}),{alignment:AlignmentType.CENTER})]})},
      children:bodyChildren},
  ],
});
fs.writeFileSync(outputPath,await Packer.toBuffer(doc));
console.log(outputPath);
