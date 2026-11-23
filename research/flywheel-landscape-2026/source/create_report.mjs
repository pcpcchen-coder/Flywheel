import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header,
  HeadingLevel, ImageRun, ImportedXmlComponent, Packer, PageBreak, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  convertInchesToTwip,
} from "docx";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("Usage: node create_report.js /absolute/path/output.docx");
const outDir = path.dirname(outputPath);
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(sourceDir,"assets");
const imageDir = path.join(sourceDir,"images");
const T = String.raw;
const C = { dark:"183B36", primary:"24534C", copper:"A85F36", text:"27312F", muted:"65716D", line:"D6DDD9", pale:"EDF2EF", warm:"F5F1EA", white:"FFFFFF" };
const font = { ascii:"Arial", hAnsi:"Arial", cs:"Arial", eastAsia:"Noto Sans CJK TC" };
const serif = { ascii:"Georgia", hAnsi:"Georgia", cs:"Georgia", eastAsia:"Noto Serif CJK TC" };
const run = (text, o={}) => new TextRun({text:String(text),font,size:21,color:C.text,...o});
const para = (children,o={}) => new Paragraph({spacing:{after:130,line:320},...o,children:Array.isArray(children)?children:[children]});
const p = (text,o={}) => para(run(text),{indent:{firstLine:convertInchesToTwip(0.30)},...o});
const plain = (text,o={}) => para(run(text),o);
const bullet = (text,o={}) => para(run(text),{bullet:{level:0},spacing:{after:90,line:300},...o});
const small = (text,o={}) => para(run(text,{size:17,color:C.muted}),{spacing:{after:90,line:250},...o});
const h1 = (text) => para(run(text,{font:serif,bold:true,size:31,color:C.dark}),{heading:HeadingLevel.HEADING_1,spacing:{before:340,after:180},keepNext:true});
const h2 = (text) => para(run(text,{bold:true,size:25,color:C.primary}),{heading:HeadingLevel.HEADING_2,spacing:{before:260,after:120},keepNext:true});
const h3 = (text) => para(run(text,{bold:true,size:22,color:C.copper}),{heading:HeadingLevel.HEADING_3,spacing:{before:190,after:100},keepNext:true});
const pageBreak = () => new Paragraph({children:[new PageBreak()]});
const link = (text,url) => new ExternalHyperlink({link:url,children:[run(text,{color:C.primary,underline:{}})]});
const rule = () => para(run(""),{border:{bottom:{style:BorderStyle.SINGLE,size:5,color:C.line,space:1}},spacing:{after:160}});
const callout = (title,text) => new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[180,9180],rows:[new TableRow({children:[
  new TableCell({width:{size:180,type:WidthType.DXA},shading:{type:ShadingType.CLEAR,fill:C.copper},margins:{top:80,bottom:80,left:0,right:0},children:[plain("")]}),
  new TableCell({width:{size:9180,type:WidthType.DXA},shading:{type:ShadingType.CLEAR,fill:C.warm},margins:{top:150,bottom:150,left:180,right:180},children:[para(run(title,{bold:true,color:C.copper}),{spacing:{after:65}}),para(run(text),{spacing:{after:0,line:300}})]})
]})]});
const xmlEscape = v => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const toc = entries => ImportedXmlComponent.fromXmlString(`<w:sdt xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:sdtPr><w:alias w:val="目錄"/></w:sdtPr><w:sdtContent><w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/><w:instrText xml:space="preserve"> TOC \\o &quot;1-3&quot; \\h \\z \\u </w:instrText><w:fldChar w:fldCharType="separate"/></w:r></w:p>${entries.map(({title,level,page})=>`<w:p><w:pPr><w:pStyle w:val="TOC${level}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs><w:ind w:left="${Math.max(0,level-1)*360}"/></w:pPr><w:r><w:t>${xmlEscape(title)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${page}</w:t></w:r></w:p>`).join("")}<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:sdtContent></w:sdt>`).root[0];

function table(headers, rows, widths, opts={}) {
  const total = widths.reduce((a,b)=>a+b,0);
  if (total!==9360) throw new Error(`Table widths must total 9360, got ${total}`);
  const border = {style:BorderStyle.SINGLE,size:3,color:C.line};
  const mk = (value,header=false,i=0) => new TableCell({
    width:{size:widths[i],type:WidthType.DXA},
    shading:{type:ShadingType.CLEAR,fill:header?C.dark:(opts.stripe===false?C.white:(Math.floor((opts._row||0)%2)?C.pale:C.white))},
    margins:{top:95,bottom:95,left:100,right:100},
    borders:{top:border,bottom:border,left:{style:BorderStyle.NIL},right:{style:BorderStyle.NIL}},
    children:[para(run(value,{size:opts.fontSize||17,bold:header,color:header?C.white:C.text}),{alignment:header?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{after:0,line:240}})]
  });
  const trs=[new TableRow({tableHeader:true,children:headers.map((x,i)=>mk(x,true,i))})];
  rows.forEach((r,ri)=>{opts._row=ri;trs.push(new TableRow({children:r.map((x,i)=>mk(x,false,i))}));});
  return new Table({width:{size:9360,type:WidthType.DXA},columnWidths:widths,rows:trs});
}
function figure(file,width,caption,source,dir=assetDir){
  const fp=path.join(dir,file); const {width:w,height:h}=imageSize(fp);
  return [para(new ImageRun({type:path.extname(fp).slice(1)==="jpg"?"jpg":"png",data:fs.readFileSync(fp),transformation:{width,height:Math.round(width*h/w)}}),{alignment:AlignmentType.CENTER,spacing:{before:120,after:60}}),small(caption,{alignment:AlignmentType.CENTER}),small(source,{alignment:AlignmentType.CENTER})];
}
function imageSize(fp){
  const b=fs.readFileSync(fp);
  if(b.readUInt32BE(0)===0x89504E47){return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};}
  let i=2; while(i<b.length){if(b[i]!==0xFF){i++;continue;}const marker=b[i+1];const len=b.readUInt16BE(i+2);if([0xC0,0xC1,0xC2].includes(marker))return {height:b.readUInt16BE(i+5),width:b.readUInt16BE(i+7)};i+=2+len;} return {width:1200,height:800};
}

const sources = [
["S01","Bolund, Bernhoff & Leijon（2007），Flywheel energy and power storage systems","https://doi.org/10.1016/j.rser.2005.01.004"],
["S02","Amiryar & Pullen（2017），A Review of Flywheel Energy Storage System Technologies and Their Applications","https://doi.org/10.3390/app7030286"],
["S03","Mousavi et al.（2017），A comprehensive review of Flywheel Energy Storage System technology","https://doi.org/10.1016/j.rser.2016.09.060"],
["S04","Olabi et al.（2021），Critical Review of Flywheel Energy Storage System","https://doi.org/10.3390/en14082159"],
["S05","Xu et al.（2023），A Review of Flywheel Energy Storage System Technologies","https://doi.org/10.3390/en16186462"],
["S06","Hu et al.（2023），A review of flywheel energy storage rotor materials and structures","https://www.sciencedirect.com/science/article/pii/S2352152X2302474X"],
["S07","Takarli et al.（2023），Electrical machines, power electronics converters, and control systems review","https://ieeexplore.ieee.org/document/10203021/"],
["S08","Bamisile et al.（2023），Development and prospect of flywheel energy storage technology","https://doi.org/10.1016/j.egyr.2023.05.147"],
["S09","Dai et al.（2024），An overview of the R&D of flywheel energy storage technologies in China","https://doi.org/10.3390/en17225531"],
["S10","Liu et al.（2026），A review of energy-saving technologies for magnetic bearings in FESS","https://doi.org/10.1063/5.0320285"],
["S11","Amiryar & Pullen（2020），Analysis of Standby Losses and Charging Cycles in FESS","https://doi.org/10.3390/en13174441"],
["S12","Venturini et al.（2024），Windage loss characterisation for FESS","https://doi.org/10.1016/j.energy.2024.132641"],
["S13","Dragoni（2019），Mechanical design of flywheels for energy storage","https://doi.org/10.1177/1464420717729415"],
["S14","Ichihara et al.（2005），Superconducting Magnetic Bearings for a 10 kWh-Class FESS","https://doi.org/10.1109/TASC.2005.849622"],
["S15","Mukoyama et al.（2017），Superconducting Magnetic Bearing for 300 kW FESS","https://doi.org/10.1109/TASC.2017.2652327"],
["S16","Hashim et al.（2026），MPC framework with fatigue life assessment for active magnetic bearing FESS","https://doi.org/10.1038/s41598-026-66926-y"],
["S17","Pichot et al.（1997），The Flywheel Battery Containment Problem","https://doi.org/10.4271/970242"],
["S18","Wang et al.（2024），Adaptive-SOC primary frequency regulation for battery–flywheel HESS","https://doi.org/10.12158/j.2096-3203.2024.05.012"],
["S19","Barelli et al.（2019），Flywheel hybridization to improve battery life in RES plants","https://doi.org/10.1016/j.energy.2019.02.143"],
["S20","Han et al.（2026），Battery Degradation Reduction in Flywheel–Battery HESS","https://doi.org/10.1002/ese3.70656"],
["S21","Elkholy, Schwarz & Aziz（2024），Strategic modeling and optimization of flywheel and hydrogen-based energy system","https://doi.org/10.1016/j.est.2024.113771"],
["S22","Baldinelli, Barelli & Bidini（2019），Reversible solid oxide cells–flywheel hybrid storage","https://doi.org/10.1016/j.est.2019.03.018"],
["S23","Popova et al.（2025），Storage technologies for post-fault recovery in large electrolyzer facilities","https://ieeexplore.ieee.org/document/11180317/"],
["S24","Stornetic，DuraStor 官方產品規格","https://www.stornetic.com/our-technology/durastor"],
["S25","Stornetic，EnWheel 官方產品規格","https://www.stornetic.com/our-technology/enwheel"],
["S26","Active Power，CleanSource PLUS MMS 官方資料表","https://www.activepower.com/wp-content/uploads/2023/10/CleanSource-PLUS-MMS-CE-300-2400kW-380-400-415V.pdf"],
["S27","Piller，Flywheel energy storage 官方產品頁","https://www.piller.com/product/energy-storage-flywheels-and-battery-systems/"],
["S28","Amber Kinetics，M32 官方資料表","https://www.amberkinetics.com/wp-content/uploads/2020/05/Amber-Kinetics-DataSheet.pdf"],
["S29","美國 DOE，Hazle Spindle 20 MW Flywheel Frequency Regulation Plant","https://www.energy.gov/oe/articles/arra-sgdp-hazle-spindle-20-mw-flywheel-frequency-regulation-plant-formerly-beacon-power"],
["S30","美國 DOE，Amber Kinetics Flywheel Energy Storage Demonstration","https://www.energy.gov/documents/ess-2012-peer-review-amber-kinetics-flywheel-energy-storage-demo-ed-chiao-amber"],
["S31","EU CORDIS，AdD HyStor 混合飛輪示範","https://cordis.europa.eu/project/id/760443"],
["S32","長治市政府，鼎輪 30 MW 飛輪儲能項目併網","http://www.zhangzi.gov.cn/xwdt/snyw/202409/t20240923_2955543.html"],
["S33","中國國家能源局，《中國新型儲能發展報告（2025）》","http://www.nea.gov.cn/20250731/1d40d09f75714280a9218d5bea178fbd/202507311d40d09f75714280a9218d5bea178fbd_453d9a0609da1d4456a8b12d843bd256cf.pdf"],
["S34","CNESA，朔州鋰電－飛輪混合儲能調頻項目","https://en.cnesa.org/china-market-update/2022/5/16/lithium-ion-battery-flywheel-hybrid-storage-system-was-firstly-used-in-frequency-regulation-in-grid-of-china"],
["S35","文水 200 MW/100.83 MWh 混合儲能全容量併網（2026-04）","https://mnewenergy.in-en.com/html/newenergy-2451643.shtml"],
["S36","綿陽港旗一期 15 MW/0.525 MWh 飛輪＋100 MW/200 MWh 電化學儲能","https://eraes.com.cn/newsinfo/8935876.html"],
["S37","Utsira Wind Power and Hydrogen Plant 專案簡介","http://www.newenergysystems.no/files/H2_Utsira.pdf"],
["S38","Natural Resources Canada，Raglan 礦場風－儲能微電網示範","https://natural-resources.canada.ca/energy/funding/current-funding-programs/energy-innovation-program/clean-energy-fund-projects/glencore-raglan-mine-renewable-electricity-smart-grid-pilot-demonstration/4934"],
["S39","Leclanché／S4 Energy，Almelo 飛輪－鋰電混合系統","https://www.leclanche.com/leclanche-and-s4-energy-complete-hybrid-energy-storage-project-in-the-netherlands/"],
["S40","Leclanché／S4 Energy，Heerhugowaard 混合系統","https://www.leclanche.com/leclanche-completes-second-hybrid-energy-storage-system-with-s4-energy/"],
["S41","GB/T 44933-2024《電力儲能用飛輪儲能系統技術規範》","http://hbed.powerchina.cn/col/col2577/art/2025/art_340705ae258c4756ad96009acee7a4ac.html"],
["S42","GB/T 44934-2024《電力儲能用飛輪儲能單元技術規範》","https://www.spc.org.cn/online/a928ac98cb9f3fbbbdbc581142ede24d.html"],
["S43","GB/T 46372-2025《飛輪儲能電站調試導則》","https://www.antpedia.com/standard/standard.php?keyword=%E5%82%A8%E8%83%BD%E6%A8%A1%E5%BC%8F"],
["S44","Sandia National Laboratories，Recommended Practices for the Safe Design and Operation of Flywheels","https://www.osti.gov/servlets/purl/1331512"],
["S45","天眼查企業工商與專利資料庫，企業存續／專利樣本查詢（2026-10-30）","https://www.tianyancha.com/"],
["S46","CN122823458B，飛輪儲能與構網型風電耦合調頻參數優化","https://patents.google.com/patent/CN122823458B/zh"],
["S47","CN122993347A，低損耗高可靠性全懸浮飛輪儲能裝置及方法","https://patents.google.com/patent/CN122993347A/zh"],
["S48","CN122993346A，磁懸浮飛輪儲能裝置","https://patents.google.com/patent/CN122993346A/zh"],
["S49","CN121923377B，飛輪－鋰電動態能量分配與風險預警","https://patents.google.com/patent/CN121923377B/zh"],
["S50","CN122512415A，飛輪陣列的調用方法、裝置、設備及存儲介質","https://patents.google.com/patent/CN122512415A/zh"],
["S51","CN122553283A，飛輪陣列的智能控制方法","https://patents.google.com/patent/CN122553283A/zh"],
["S52","CN117200282B，飛輪陣列兩階段功率分配","https://patents.google.com/patent/CN117200282B/zh"],
["S53","CN116706959B，飛輪陣列併網與慣量／無功支撐","https://patents.google.com/patent/CN116706959B/zh"],
["S54","CN118117812A，飛輪儲能單元拓撲及五自由度轉子解耦","https://patents.google.com/patent/CN118117812A/zh"],
["S55","CN122678386A，感應子電機與磁軸承整合飛輪裝置","https://patents.google.com/patent/CN122678386A/zh"],
["S56","CN122338713A，高壓直流供電控制系統及方法","https://patents.google.com/patent/CN122338713A/zh"],
["S57","CN119813502A，使用分裂變壓器的飛輪儲能 UPS","https://patents.google.com/patent/CN119813502A/zh"],
["S58","CN119786087A，反應堆控制棒供電系統","https://patents.google.com/patent/CN119786087A/zh"],
["S59","台達×泓慧 10 kV 中壓 UPS 發布資料（廠商新聞稿）","https://www.prnasia.com/story/529703-1.shtml"],
["S60","Torus，Nova Spin 官方技術頁","https://www.torus.co/torus-flywheel"],
["S61","Greentown Labs，Revterra kinetic energy storage","https://greentownlabs.com/revterras-kinetic-energy-storage-brings-stability-to-the-grid-ai-data-centers-and-more/"],
["S62","Energiestro VOSS 技術與量產進度報導","https://www.compositesworld.com/articles/high-tension-vertical-filament-winding-enables-affordable-flywheel-energy-storage-system"],
["S63","QuinteQ Energy 技術與公司資料","https://www.energystoragenl.nl/en/lid/quinteq/"],
["S64","Beacon Power 所有權與資產分拆公告","https://beaconpower.com/news/"],
["S65","貝肯新能源，Temporal Power 技術傳承說明","http://www.bne-fess.cn/en/"],
["S66","Langley Holdings，Active Power／Piller 公司資料","https://www.langleyholdings.com/"],
["S67","Calnetix 收購 VYCON 公告","https://www.prnewswire.com/news-releases/calnetix-technologies-acquires-vycon-283185621.html"],
["S68","中國《新型儲能規模化建設專項行動方案（2025—2027年）》相關政策摘要","https://www.jl.gov.cn/szfzt/tzjlwx/zdxm/xyxm/202604/t20260429_3627846.html"],
["S69","IEC 62933，Electrical energy storage systems 系列","https://webstore.iec.ch/en/publication/62467"],
["S70","IEEE 1547-2018，分散式能源併網互連標準","https://standards.ieee.org/ieee/1547/5915/"],
["S71","UL 9540，Energy Storage Systems and Equipment","https://www.ul.com/services/ul-9540-energy-storage-systems-and-equipment"],
["S72","UL 1778，Uninterruptible Power Systems","https://www.ul.com/services/uninterruptible-power-supply-ups-equipment"],
["S73","VYCON／Calnetix，VDC 系列產品資料","https://www.calnetix.com/vycon-energy/"],
["S74","Energy-Storage.news，鼎輪 30 MW 專案現場圖像與報導","https://www.energy-storage.news/worlds-largest-30mw-flywheel-energy-storage-project-connects-to-grid-in-china/"],
["S75","Choudhury（2021），FESS critical review on technologies, applications and prospects","https://doi.org/10.1002/2050-7038.13024"],
["S76","Yimenicioğlu & Yalman（2026），Hybrid Energy Storage Systems review","https://www.mdpi.com/2313-0105/12/8/300"]
];

sources.push(
["S77","Amber Kinetics 美國專利清單（Justia Patents）","https://patents.justia.com/assignee/amber-kinetics-inc"],
["S78","Beacon Power 美國專利清單（Justia Patents）","https://patents.justia.com/assignee/beacon-power-llc"],
["S79","US12078221B2，Flywheel energy storage device","https://patents.justia.com/patent/12078221"],
["S80","CN108869543B，混合式超導磁軸承（法律狀態抽樣）","https://patents.google.com/patent/CN108869543B/zh"],
["S81","CN108900039B，飛輪儲能轉子真空散熱系統","https://patents.google.com/patent/CN108900039B/zh"],
["S82","CN122419082A，飛輪儲能裝置的電機及飛輪儲能裝置","https://patents.google.com/patent/CN122419082A/zh"],
["S83","CN120357630A，分佈式磁懸浮飛輪網路儲能系統","https://patents.google.com/patent/CN120357630A/zh"],
["S84","CN122697432A，混合儲能裝置及其功率分配方法","https://patents.google.com/patent/CN122697432A/zh"],
["S85","CN116040917A，風光互補、飛輪增量與儲能電解制氫","https://patents.google.com/patent/CN116040917A/zh"],
["S86","US10693342B2，Containing a field of flywheel energy storage units","https://patents.justia.com/patent/10693342"]
);

const papers = [
["Bolund et al.","2007","總體架構","建立轉子—軸承—電機—真空—變流器分析框架；經典但不含近期磁懸浮進展。","S01"],
["Amiryar & Pullen","2017","總體／應用","比較高低速飛輪、軸承、電機與應用；定性為主，經濟量化有限。","S02"],
["Mousavi et al.","2017","拓撲／電網","涵蓋建模、拓撲與電網應用；市場背景早於近期中國商轉潮。","S03"],
["Olabi et al.","2021","總體","材料、軸承、成本與應用批判性回顧；部分成本引用較舊。","S04"],
["Choudhury","2021","技術／前景","系統梳理技術、應用與未來方向；適合做應用分類起點。","S75"],
["Xu et al.","2023","高速磁懸浮","高速磁懸浮、轉子強度、軸承與電機的近期完整綜述。","S05"],
["Hu et al.","2023","轉子材料","比較金屬與複材轉子材料、幾何與應力設計。","S06"],
["Takarli et al.","2023","電機／變流／控制","把電機、功率電子與控制放在同一系統鏈檢視。","S07"],
["Bamisile et al.","2023","文獻計量","研究熱點由部件走向調頻、陣列與混合系統；計量不等同成熟度。","S08"],
["Dai et al.","2024","中國研發","整理中國研究機構、工程化路線與產業進展。","S09"],
["Amiryar & Pullen","2020","待機損耗","風損、軸承損與充電循環建模；自放電隨轉速非線性變化。","S11"],
["Venturini et al.","2024","風損實驗","以台架驗證風損模型與非侵入式自放電量測。","S12"],
["Liu et al.","2026","磁軸承節能","銅損、鐵損、永磁偏置與低功耗控制，直指待機痛點。","S10"],
["Hashim et al.","2026","壽命感知控制","將疲勞壽命評估嵌入 MPC；仍屬模型／研究驗證。","S16"],
["Wang et al.","2024","鋰電混合調頻","自適應 SOC 功率分配，避免飛輪過充過放並改善一次調頻。","S18"],
["Han et al.","2026","電池衰退","衰退導向模糊 PI 調參；電池壽命改善屬研究結果，不能直接外推所有場站。","S20"],
["Elkholy et al.","2024","氫能混合模擬","燃料電池容量在模型中由 100 kW 降至 30 kW；飛輪效率受寄生損耗影響。","S21"],
["Baldinelli et al.","2019","rSOC＋飛輪","以飛輪補快速爬坡、rSOC 補長時能量；屬微電網建模證據。","S22"]
];
const products = [
["Beacon Power Gen4","100 kW","25 kWh","約 15 min","DOE：100% DoD、>150,000 全循環、20 年+設計目標；既有電站商轉，製造主體低度營運。","S29／S64"],
["Amber Kinetics M32","8 kW","32 kWh","4 h","DC 往返效率 >86%、<1 s 反應、30 年設計壽命；小規模商業部署。","S28"],
["Active Power CleanSource PLUS MMS","300–2,400 kW","6.2 MJ／模組","最長約 2 min（視配置／負載）","UPS 效率口徑最高 96–98%；20 年飛輪設計壽命，軸承有定期更換要求。","S26"],
["Piller POWERBRIDGE","最高 MW 級","3.6–60+ MJ","秒級至約 1 min","低速重型關鍵電力路線；需依實際負載曲線核算 ride-through。","S27"],
["VYCON VDC XXE","300 kW+","6,000 kW·s（約 1.67 kWh）","秒級","直流母排式 UPS 儲能；單程效率不是系統 AC 往返效率。","S73"],
["Stornetic DuraStor 240","240 kW","動能 16；有效 9.2 kWh","120 s","典型 RTE 80%（含輔機）、<30 ms、20 年+機械預期壽命。","S24"],
["Stornetic DuraStor 1000","1,000 kW","動能 64；有效 37 kWh","122 s","典型 RTE >82%（含輔機）、<40 ms；貨櫃化模組。","S24"],
["Torus Nova Spin","官方未定額","官方未定額","6 min 完整放電（10C）","25,000 循環、25 年、<250 ms；以飛輪＋LFP 混合方案銷售。","S60"],
["Revterra S100","400 kW 基型","100 kWh","約 15 min（核算）","被動磁浮／超導穩定、約 50 W 待機為開發方口徑；早期商業化。","S61"],
["Energiestro VOSS","約 10 kW","10 kWh","約 1 h","混凝土＋玻纖轉子；beta／試量產前，非成熟量產品。","S62"],
["QuinteQ 模組","100 kW","5 kWh","約 3 min（核算）","Boeing 技術授權、超導磁浮；初期商業部署。","S63"],
["坎德拉一次調頻系列","1 MW","10／35 kWh","約 36／120 s","高倍率磁懸浮產品；規格與出貨量主要為廠商口徑。","S45"],
["華馳大飛輪系列","最高 4 MW","最高 1,000 kWh","15 min（該型）","五自由度全磁懸浮；單機大功率與循環次數需逐案驗收。","S45"],
["泓慧＋台達 10 kV 中壓 UPS","1–24 MW 配置","依 UPS 配置","3 s–1 min（DVR）","2026 發布；>98% 端到端為發布會規格，非第三方長期運轉驗證。","S59"]
];
const patents = [
["US12078221B2","全複材纏繞轉子","Clegern","授權（2024）","複材幾何與應力分擔；FEA 設計證據，不代表產品運轉。","S79"],
["US11362558B2","疊片鋼轉子","Amber Kinetics","授權（2022）","大質量長時鋼轉子路線。","S77"],
["US9267570B2","複材飛輪輪轂","Beacon Power","授權（2016）","纖維方向與軸／輪緣接合。","S78"],
["US9892839B2","磁卸載軸承","Amber Kinetics","授權（2018）","降低機械軸承負載與懸浮功耗。","S77"],
["CN108869543B","混合式超導磁軸承","中科院電工所","2024 未繳年費終止","顯示專利存在不等於可實施權利仍有效。","S80"],
["US11085420B2","真空腔密封","Amber Kinetics","授權（2021）","降低氣體滲入真空腔。","S77"],
["US11271452B2","分叉式分子泵","Amber Kinetics","授權（2022）","真空維持與待機損耗相關。","S77"],
["CN108900039B","真空轉子散熱","中科院工程熱物理所","授權（2024）","輻射散熱與熱管迴路。","S81"],
["US11682943B2","定子常壓電機","Amber Kinetics","授權（2023）","轉子真空、定子常壓的分壓設計。","S77"],
["CN122419082A","高速電機整合","瀋陽微控","實質審查","申請中，不是授權技術屏障結論。","S82"],
["CN122678386A","電機／磁軸承整合","北京泓慧","實質審查","感應子電機、磁路隔離與五自由度懸浮。","S55"],
["US10693342B2","地埋式飛輪陣列","Amber Kinetics","授權（2020）","多單元配置與安全容納。","S86"],
["CN120357630A","分佈式飛輪網路","奇峰聚能／西電","實質審查","多機組網與併網同步。","S83"],
["CN122512415A","健康感知陣列調用","坎德拉","實質審查","由單機控制走向可用度／健康度調度。","S50"],
["CN122823458B","構網風電耦合調頻","內蒙古工業大學等","授權（2026-10-27）","飛輪與構網型風電參數協同。","S46"],
["CN122697432A","電池損傷導向分配","瀋陽微控","實質審查","把電池損傷係數納入混合功率分配。","S84"],
["CN116040917A","飛輪增量電解制氫","浙江榮越","實質審查（2024 生效）","專利布局零星，不能視為商業化證據。","S85"]
];
const companies = [
["瀋陽微控飛輪技術股份有限公司","存續","17,000 萬人民幣","2018-03-16","電網調頻、UPS、磁軸承；上市輔導標籤。部署／營運時數多為公司口徑。"],
["北京泓慧國際能源技術發展股份有限公司","存續","3,500.17 萬人民幣","2015-04-14","磁懸浮飛輪、關鍵電力；上市輔導標籤。"],
["坎德拉（深圳）新能源科技股份有限公司","存續","1,270.43 萬人民幣","2018-05-10","高倍率一次調頻、陣列控制、混合儲能。"],
["華馳動能（北京）科技有限公司","存續","1,967.95 萬人民幣","2019-11-26","大功率全磁懸浮飛輪與調頻項目。"],
["貝肯新能源有限公司","存續","6,591.29 萬人民幣","2017-12-01","承接 Temporal Power 技術；鼎輪 30 MW 設備／方案。"],
["北京奇峰聚能科技有限公司","存續","8,571.43 萬人民幣","2009-05-08","分佈式飛輪網路與混合控制；工商含風險標籤，應另做信用核查。"],
["羅特尼克能源科技（北京）有限公司","存續","1,416.66 萬美元","2012-10-26","高速複材飛輪；工商含破產案件風險標籤，不能僅憑存續判斷經營品質。"],
["博鼎儲能科技（山東）有限公司","存續","5,000 萬人民幣","2021-05-21","磁軸承與儲能部件／系統；公開證據較少。"]
];
const projects = [
["Stephentown／Hazle，美國","20 MW／站","純飛輪調頻","商業運轉","2011／2014 起；Beacon 技術，後由資產營運商持有。DOE 記錄 Gen4 100 kW/25 kWh。","S29／S64"],
["Minto／Clear Creek，加拿大","2／5 MW","飛輪調頻，後續混合改造","既有專案","Temporal Power 技術；公司終止不等於資產消失，需逐站核查現況。","S65"],
["鼎輪長治，中國","30 MW，120 台","純飛輪獨立調頻","2024 併網","12 套陣列，每套 10 台高速磁懸浮飛輪；官方併網證據。","S32"],
["朔州熱電，中國","5 MW/5 MWh LFP＋2 MW/0.4 MWh 飛輪","火儲 AGC","示範投運","中國早期鋰電－飛輪聯合調頻案例。","S34"],
["Almelo／Heerhugowaard，荷蘭","約 10 MW 級","飛輪＋鋰電 FCR","商業運轉","S4／Leclanché；電池壽命改善為專案方口徑，不宜外推固定倍率。","S39／S40"],
["Schwungrad／EirGrid，愛爾蘭","早期 160 kW 級","飛輪＋電池快速頻率支撐","示範","後續 AdD HyStor 目標由 TRL6 向 TRL8；不是大規模商業容量證明。","S31"],
["綿陽港旗一期，中國","100 MW/200 MWh＋15 MW/0.525 MWh","混合獨立儲能","2026 報導商轉","15 套飛輪系統與 40 個電池倉；完成併網與一次調頻測試的報導。","S36"],
["文水，中國","總規模 200 MW/100.83 MWh","混合獨立儲能","2026 全容量併網","400 台 125 kW 飛輪＋LFP；併網後調試與正式投運需分開表述。","S35"],
["Raglan 礦場，加拿大","風電＋200 kW 飛輪＋氫＋電池","離網微電網","2014–2019 示範","飛輪負責次秒平滑，氫負責長時；不是電解槽專用商用配套。","S38"],
["Utsira，挪威","風電＋飛輪＋氫","島嶼微電網","2004–2010 歷史示範","來源對飛輪 5 kW／5 kWh 口徑不一；僅證明系統整合可行性。","S37"]
];

const children=[];
children.push(
  para(run("技術・產業・證據整合",{size:18,bold:true,color:C.copper}),{alignment:AlignmentType.CENTER,spacing:{before:1050,after:260}}),
  para(run("飛輪儲能技術全景報告",{font:serif,size:52,bold:true,color:C.dark}),{alignment:AlignmentType.CENTER,spacing:{after:180}}),
  para(run("學術研究、專利版圖、代表廠商與商業產品",{size:25,color:C.primary}),{alignment:AlignmentType.CENTER,spacing:{after:80,line:390}}),
  para(run("鋰電／氫能整合及 2027–2031 發展情境",{size:25,color:C.primary}),{alignment:AlignmentType.CENTER,spacing:{after:400,line:390}}),
  rule(),
  para(run("研究截點：2026 年 10 月 30 日",{size:20,color:C.muted}),{alignment:AlignmentType.CENTER,spacing:{before:280,after:70}}),
  para(run("版本：完整技術報告｜繁體中文",{size:18,color:C.muted}),{alignment:AlignmentType.CENTER,spacing:{after:500}}),
  callout("證據使用原則","本報告把「商業運轉」「示範／試點」「學術模擬／概念」「2027–2031 前瞻假設」分開。廠商規格均標示來源，不把發布會參數當成第三方實績，也不把專利申請視為可實施權利或商業化證明。"),
  pageBreak(),
  para(run("目錄",{font:serif,size:34,bold:true,color:C.dark}),{heading:HeadingLevel.HEADING_1,spacing:{after:160}}),
  small("頁碼為排版預估；在 Word／WPS 中更新目錄域即可刷新。"),
  toc([
    {title:"決策摘要",level:1,page:3},{title:"1. 研究範圍、方法與證據分級",level:1,page:4},
    {title:"2. 技術原理與系統架構",level:1,page:4},{title:"3. 關鍵部件與工程取捨",level:1,page:7},
    {title:"4. 性能、成本與比較口徑",level:1,page:8},{title:"5. 學術現況與研究前沿",level:1,page:10},
    {title:"6. 專利版圖與權利狀態",level:1,page:11},{title:"7. 全球廠商與產品",level:1,page:13},
    {title:"8. 中國企業與產業化",level:1,page:15},{title:"9. 專案證據與應用成熟度",level:1,page:16},
    {title:"10. 飛輪＋鋰電混合儲能",level:1,page:17},{title:"11. 飛輪＋氫能整合",level:1,page:19},
    {title:"12. 安全、標準與採購驗收",level:1,page:19},{title:"13. 2027–2031 發展情境",level:1,page:20},
    {title:"14. 結論與行動建議",level:1,page:21},{title:"附錄：參考資料與盡調清單",level:1,page:23}
  ]),
  pageBreak(),
  h1("決策摘要"),
  plain("一句話定位：飛輪是「高功率、高循環、秒至分鐘級」的功率型儲能；鋰電是小時級能量載體，氫能則面向更長時與跨部門能源。三者最合理的關係是分工，而不是互相取代。",{spacing:{after:200,line:350}}),
  callout("核心判斷","2026 年最可投資、可採購的飛輪價值集中在 UPS／關鍵電力、電網調頻與飛輪－鋰電混合。小時級純飛輪與飛輪－氫能應以逐案技術驗證看待，不宜用同一套市場成長故事估值。"),
  h2("八項可直接用於決策的結論"),
  bullet("① UPS 是最成熟的商業市場。Active Power／Piller、VYCON 等已有長期產品線；AI 資料中心帶來新需求，但 2026 年發布的中壓 SST＋飛輪 UPS 仍需用實際負載與故障測試驗證。[S26][S27][S59][S73]"),
  bullet("② 電網調頻已有 20–30 MW 級運轉證據。美國 Beacon 兩站與中國鼎輪 30 MW 證明陣列工程可行；收益取決於輔助服務規則、可用率、調頻里程與待機電費，不是只看效率。[S29][S32]"),
  bullet("③ 飛輪－鋰電已由示範進入多國商業部署。飛輪承擔高頻微循環，鋰電承擔低頻與長時能量；電池壽命改善必須以同場對照、吞吐量與衰退模型驗收。[S18–S20][S34–S40]"),
  bullet("④ 飛輪－氫能尚不是成熟產品市場。Raglan、Utsira 是微電網示範；近期研究以模擬為主。飛輪能平滑電解槽輸入，但不能解決氫儲能低往返效率或長時容量問題。[S21–S23][S37][S38]"),
  bullet("⑤ 產品規格不可直接橫排。動能不等於有效放電能；DC-DC、AC-AC、UPS 效率與含輔機 RTE 是不同口徑；MJ、kW·s 與 kWh 必須先換算。[S24–S28][S73]"),
  bullet("⑥ 待機損耗是商業模型核心。高速、真空、磁懸浮降低摩擦，但磁軸承、真空泵、冷卻、控制與馬達空載損仍存在；長時間閒置會侵蝕可用能量與電費。[S10–S12]"),
  bullet("⑦ 專利重心由部件走向陣列與健康調度。轉子、磁軸承、真空密封仍是壁壘；2024–2026 樣本顯示陣列調用、構網耦合、混合功率分配快速增加。專利狀態與權利範圍仍需逐件法律核查。[S45–S58][S77–S86]"),
  bullet("⑧ 未來五年基準情境不是全面取代鋰電，而是混合化與場景深化。UPS、調頻與工業電能品質持續增長；長時純飛輪與氫能耦合是否突破，取決於可複製運轉案與第三方性能數據。"),
  h2("建議的技術選型順序"),
  table(["需求訊號","優先方案","不建議的誤用","首要驗收指標"],[
    ["每日大量秒級充放、調頻里程高","純飛輪或飛輪－鋰電","用 4 h 電池硬吃全部高頻微循環","反應時間、里程、可用率、待機 kW"],
    ["關鍵負載需 5–60 s 橋接","飛輪 UPS／直流母排飛輪","用能量型飛輪長時備援","負載曲線、切換、故障旁路、維護間隔"],
    ["需 1–4 h 能量搬移又有高頻波動","飛輪＋LFP 混合","為單一峰值把全系統做成飛輪","電池吞吐、SOC／轉速恢復、混合 RTE"],
    ["離網風光＋電解制氫","飛輪平滑＋氫長時，必要時加電池","期待飛輪提供隔夜或季節儲能","電解槽最小負載、爬坡、儲氫 autonomy"],
    ["單純 4 h 以上峰谷套利","優先比較 LFP／其他長時技術","僅因循環壽命選純飛輪","$/kWh、全年利用小時、輔機與更換成本"]
  ],[2000,2180,2660,2520]),
  pageBreak(),
  h1("1. 研究範圍、方法與證據分級"),
  h2("1.1 範圍"),
  p("本報告覆蓋電網級與關鍵電力用飛輪儲能系統（FESS），包括轉子、軸承、真空與熱管理、電機、功率電子、控制、陣列、安全與標準；並盤點學術論文、代表性專利、全球與中國廠商、產品規格、商業專案，以及鋰電和氫能混合架構。車用 KERS 與航太姿態控制只在其技術可轉移時納入，不作完整市場盤點。"),
  h2("1.2 研究方法"),
  bullet("學術：以 Scholar 檢索綜述、轉子、磁軸承、損耗、電機與控制、鋰電／氫能混合，並以 DOI、期刊頁或原文摘要核對。新發表論文不因年份新就自動視為成熟技術。"),
  bullet("企業：以天眼查查核中國企業全稱、存續狀態、成立時間、註冊資本與風險標籤；工商存續不等同產品通過驗收或財務健全。[S45]"),
  bullet("專利：以企業與技術關鍵字抽樣，核對公開／授權／審查狀態與部分年費終止事件。不是全球專利普查，也不是自由實施（FTO）法律意見。"),
  bullet("產品：優先官方資料表、政府專案頁與電網／公用事業資料；媒體只用於補充時間線與公司狀態。對矛盾規格不取平均，保留口徑差異。"),
  h2("1.3 四層證據標籤"),
  table(["標籤","可支持的結論","不可外推的結論","本報告例子"],[
    ["商業運轉","有產品銷售、併網或持續服務證據","不能保證所有型號、所有場站同性能","Beacon 20 MW、DuraStor、Active Power UPS"],
    ["示範／試點","證明特定系統整合可行","不能直接證明量產成本與長期可靠度","Schwungrad、Raglan、Utsira"],
    ["模擬／概念","可比較控制策略、容量與物理機制","不能當成實測效率、壽命或收益","飛輪－氫容量優化、衰退控制"],
    ["前瞻假設","建立觀察指標與決策節點","不是市場承諾或確定預測","2027–2031 三情境"]
  ],[1500,2650,2850,2360]),
  h2("1.4 研究限制"),
  p("多數廠商未公開完整效率曲線、逐年可用率、故障紀錄、待機功率、維護工單與實際交易收入；公開專案也可能只揭露「併網」而未揭露「商轉驗收」。因此，本報告不給出單一全球市場規模或統一 LCOS 排名。2025–2026 專利仍有公開滯後，樣本數只用來辨識方向，不用於廠商排名。"),
  h1("2. 技術原理與系統架構"),
  h2("2.1 能量如何存取"),
  p("充電時，電網電能經變流器驅動電機，讓轉子加速；放電時，轉子拖動同一台或另一台電機發電，再由變流器整理成負載或電網所需電壓、頻率。核心動能為 E＝½Iω²，I 是轉動慣量，ω 是角速度。提高轉速比單純增加質量更能提升能量，但也同時提高應力、臨界轉速、風損與圍堵要求。[S01][S05]"),
  p("對圓盤或環形轉子，材料比強度與幾何決定可用端速。鋼轉子以成本、加工與大尺寸成熟度取勝；碳纖維複材以高比強度與輕量化取勝，但需處理各向異性、輪轂接合、蠕變、疲勞與破壞模式。真正的產品設計不是追求最高 rpm，而是在可用能量、應力裕度、熱、軸承與成本之間取平衡。[S06][S13]"),
  ...figure("02_speed_energy_window.png",560,"圖 2-1　轉速窗口與可用能量關係","來源：本報告依 E∝ω² 計算；非特定產品實測。"),
  h2("2.2 系統邊界"),
  table(["子系統","正常功能","異常／降級路徑","採購應要求資料"],[
    ["轉子與圍堵","儲存動能、維持動平衡","過速保護、受控降速、圍堵與隔離","材料／應力裕度、超速與爆裂試驗、疲勞模型"],
    ["軸承與備援軸承","支承轉子、控制五自由度","磁軸承失效時 touchdown、受控停機","功耗、振動頻譜、備援軸承壽命與更換工時"],
    ["真空與熱管理","降低風損、排出電機與電子熱","真空異常限功率／停機、冷卻降額","穩態壓力、漏率、泵功耗、熱平衡"],
    ["電機與變流器","四象限充放電、功率與無功控制","模組旁路、降額、直流母排保護","效率地圖、過載曲線、故障電流、EMC"],
    ["控制與 EMS","估計轉速／SOC、接受調度、陣列分配","通訊中斷本地安全控制、黑名單故障機","控制時延、降級策略、資料留存與資安"],
    ["站用輔機","真空、冷卻、控制、照明與消防","重要輔機冗餘與低功耗模式","各工況站用 kW、年度耗電、維護件"]
  ],[1500,2230,2600,3030]),
  h2("2.3 功率、能量與 SOC"),
  p("飛輪的 SOC 可由轉速推算，理想上 SOC＝(ω²−ωmin²)/(ωmax²−ωmin²)，但可交付能量還受電機與變流器功率、溫度、真空度與控制裕度限制。與電池相比，飛輪 SOC 可觀測性較高；與超級電容相比，飛輪能以機械慣量提供不同的動態特性。陣列控制必須避免部分單元長期處於高損耗高速或無法再吸收能量的狀態。"),
  h2("2.4 正常、異常與恢復路徑"),
  bullet("正常：EMS 接收功率指令 → 陣列分配 → 單機速度／電流控制 → 站級電壓與無功協調 → 記錄效率、溫度、振動與輔機功耗。"),
  bullet("通訊異常：站控維持最後安全指令或切至本地頻率／電壓 droop；禁止單機脫離協調後持續滿功率追逐指令。"),
  bullet("機械異常：振動、軸承位移或真空越限 → 限功率 → 受控降速 → 備援軸承接觸 → 隔離單元；陣列重分配而非整站無差別跳脫。"),
  bullet("恢復：故障原因未確認前不得自動重新加速至額定轉速；重新併網需滿足保護復歸、同步、絕緣與調度許可。")
);


children.push(
  pageBreak(),
  h1("3. 關鍵部件與工程取捨"),
  h2("3.1 轉子：最高轉速不是唯一目標"),
  p("轉子設計同時受材料強度、密度、幾何、端速、動平衡、臨界轉速與破壞模式約束。低速大質量鋼轉子適合長時與關鍵電力，高速複材轉子則以較高比強度換取功率密度；兩者的軸承、圍堵、製造與維護邏輯不同，不宜只用 rpm 或 kWh/kg 排名。[S06][S13]"),
  table(["路線","主要優勢","主要工程風險","適用情境","驗證重點"],[
    ["高強鋼／疊片鋼","加工、檢測與大尺寸經驗成熟；成本可控","質量大、臨界轉速與軸承負載；疊片結合與渦流","長時、UPS、大單機","材料批次、鍛件／疊片缺陷、超速、疲勞、動平衡"],
    ["碳纖維複材","高比強度、高速、高功率密度","各向異性、輪轂接合、蠕變、衝擊與爆裂碎片","高頻調節、緊湊型設備","纏繞張力、樹脂老化、NDT、超速與圍堵全尺寸試驗"],
    ["混凝土＋玻纖","材料便宜、可大尺寸製造","密度／強度、固化品質、長期裂縫與檢測方法","低成本長時概念","長期耐久、環境老化、尺寸公差與第三方爆裂驗證"]
  ],[1500,2080,2400,1580,1800]),
  h3("設計檢查"),
  bullet("額定與最高轉速、超速整定、最小放電轉速必須一起揭露；只給最高轉速動能會高估可用能量。"),
  bullet("複材轉子要追查纖維體積率、樹脂體系、界面與熱循環；鋼轉子要追查鍛件、疊片預緊、焊接或過盈配合。"),
  bullet("疲勞證據應覆蓋預期任務譜，而非單一恆定應力試驗；陣列調度會改變每台機組的循環深度與停留轉速。"),
  h2("3.2 軸承：低損耗與可恢復性同等重要"),
  table(["軸承方案","損耗／控制特性","失效與維護重點","工程判斷"],[
    ["機械滾珠／陶瓷","結構簡單、無主動懸浮功耗","高速發熱、潤滑與壽命；需定期更換","適合成熟 UPS 與部分低速機；維護計畫是總成本一部分"],
    ["被動磁／永磁卸載","降低接觸負載、控制簡單","剛度、阻尼、渦流與高溫退磁","常與機械或其他磁軸承混用，不能把『無接觸』等同零損耗"],
    ["主動磁軸承","五自由度可控、無接觸、適合高速","功率放大器、感測器、控制器與備援軸承","需披露銅損、鐵損、偏置方式、備援落地次數與控制失效測試"],
    ["超導磁軸承","可實現高穩定被動懸浮與低摩擦","低溫系統、冷卻功耗、磁通蠕變與失超","技術潛力高；系統效率要把冷卻與可靠性納入，不宜只比軸承本體"]
  ],[1700,2300,2800,2560]),
  p("2026 年磁軸承研究把焦點放在永磁偏置、低功耗控制、鐵損與銅損的聯合降低；疲勞壽命感知 MPC 則嘗試把轉子與軸承健康直接納入控制。這些方向重要，但研究控制器不等於已完成多年電站驗證。[S10][S16]"),
  h2("3.3 真空、熱與待機損耗"),
  p("高速轉子在空氣中會產生顯著風損，因此真空腔是常見配置；真空又讓對流散熱變差，定子、電機與磁軸承的熱必須透過輻射、熱管或分壓設計排出。常壓定子＋真空轉子能簡化散熱，但密封、絕緣、間隙與機械公差會重新成為設計難題。[S11][S12][S77]"),
  table(["損耗來源","隨工況如何變化","供應商應提供","驗收方式"],[
    ["風損","隨氣體密度、轉速與幾何非線性增加","不同真空度與轉速下的自放電曲線","斷電自然降速＋功率量測交叉驗證"],
    ["磁軸承與功率放大器","與偏置、控制策略、位移與溫度有關","額定／待機／故障三工況功耗","輔機分路電表，至少涵蓋四季溫度"],
    ["電機空載與鐵損","高速時顯著；與磁材、槽極與控制有關","效率地圖而非單一峰值效率","25／50／75／100% 功率與多轉速點"],
    ["真空、冷卻與控制","可能長時間固定存在，長時閒置占比高","各泵、風扇、冷機與 UPS 輔機清單","年度站用電、啟停次數與維護更換紀錄"]
  ],[1800,2450,2580,2530]),
  callout("採購重點","要求『額定功率下效率』之外，再要求 24 h、72 h 與 30 天的能量保持曲線、平均待機 kW、真空恢復時間與輔機維護週期。對低利用率場站，待機電費可能比效率差 1–2 個百分點更影響收益。"),
  h2("3.4 電機、功率電子與陣列控制"),
  p("高速永磁電機功率密度高，但轉子磁鋼固定、渦流與高溫退磁需謹慎處理；感應與開關磁阻電機可避開永磁體高速機械限制，代價是損耗、控制與功率密度取捨。感應子／homopolar 結構可把部分磁路與支承功能整合，適合磁懸浮飛輪，但電磁耦合與五自由度控制更複雜。[S05][S07]"),
  bullet("機側變流器：控制充放電轉矩、速度與電流；網側變流器：控制直流母排、有功／無功與併網電能品質。"),
  bullet("grid-following 依賴電網相位；grid-forming 可建立電壓與頻率參考。飛輪可用能量有限，構網能力必須同時標注可持續功率與能量窗口。"),
  bullet("陣列 EMS 應依 SOC、溫度、振動、累積疲勞、效率與故障狀態分配功率，避免平均分配造成部分機組長期高損耗或提前老化。"),
  bullet("UPS 要驗證負載階躍、旁路、發電機啟動銜接與故障穿越；電網調頻則要驗證 AGC／一次調頻指令追蹤、通訊時延、SOC 恢復與站級無功。"),

  h1("4. 性能、成本與比較口徑"),
  h2("4.1 先把規格換成同一物理量"),
  p("1 kWh＝3.6 MJ＝3,600 kW·s。若產品標示 6,000 kW·s，理想能量約 1.67 kWh；若標示 6.2 MJ，約 1.72 kWh。動能、額定能量與有效放電能仍可能不同，必須再乘上轉速窗口與放電截止條件，不能直接以換算值宣稱可交付能量。[S24][S26][S73]"),
  table(["欄位","正確比較方式","常見誤讀","報告處理"],[
    ["功率 kW／MW","持續、短時過載與併網點分開","把峰值當持續功率","保留廠商時間限制與配置條件"],
    ["能量 kWh／MJ／kW·s","先換算，再確認有效／動能口徑","最高轉速動能＝可用放電能","產品表保留原口徑與有效能量"],
    ["放電時間","以指定功率與負載曲線核算","能量÷功率可涵蓋所有負載","UPS 特別標注依負載與配置"],
    ["效率","DC-DC、AC-AC、UPS、含輔機分開","單程效率當 AC 往返效率","不對不同口徑做單一排名"],
    ["壽命／循環","DoD、任務譜、維護與更換件一起比","設計壽命＝保固或免維護年限","標示設計目標與廠商口徑"]
  ],[1700,2650,2450,2560]),
  ...figure("01_product_duration_map.png",590,"圖 4-1　代表產品的功率／放電時間定位","來源：官方產品資料與專案資料整理；對數座標，僅供定位，不作性能排名。"),
  h2("4.2 成本不能只用 LCOS 一個數字"),
  p("飛輪資本支出集中在轉子、磁軸承、真空腔、電機、功率電子與圍堵；營運支出則包括待機電費、備援軸承、機械軸承、真空泵、冷卻與定期檢修。對高循環調頻，攤到每次循環的機械磨耗可能很低；對低利用率長時備援，待機與維護會主導成本。"),
  table(["成本層","必要輸入","容易漏掉的項目","建議決策指標"],[
    ["初始投資","設備、功率電子、土建、圍堵、併網、備品","站用變壓器、消防／隔離、通訊與稅費","$/kW 與 $/kWh 分開；混合系統按功能拆分"],
    ["營運維護","站用電、定期保養、人工、遠端監控","真空與冷卻、備援軸承、軟體服務費","年度固定 O&M＋實測待機 kW"],
    ["衰退與更換","任務譜、循環深度、疲勞、電池更換","飛輪健康調度對電池壽命的影響","全生命週期吞吐與更換現值"],
    ["收益","容量、電能量、調頻、備援、避免停機","性能罰則、SOC 恢復限制、市場規則改變","多收益堆疊但不可重複計算"]
  ],[1650,2500,2700,2510]),
  h2("4.3 安全與圍堵是系統成本"),
  p("轉子失效可能產生高能碎片、軸向與徑向載荷、真空腔破裂與二次火災。圍堵設計要考慮最壞可置信破壞模式、碎片能量、鄰機間距與地埋／容器結構。公開的全尺寸爆裂與圍堵資料有限，因此不能僅以『磁懸浮』『無燃燒』推論本質安全。[S17][S44][S86]"),

  h1("5. 學術現況與研究前沿"),
  h2("5.1 文獻地圖"),
  p("2007–2021 年的經典綜述建立部件與應用框架；2023–2026 年研究更集中於高速磁懸浮、轉子材料、風損量測、低功耗磁軸承、陣列與混合控制。文獻數量增加代表研究活躍，不等於商業成熟度同步提高。[S01–S16][S75]"),
  table(["作者／年份","主題","可用結論與限制","來源"],papers.map(x=>[`${x[0]}（${x[1]}）`,x[2],x[3],`[${x[4]}]`]),[2100,1500,5010,750],{fontSize:16}),
  h2("5.2 2024–2026 前沿"),
  h3("低損耗與可量測的自放電"),
  p("風損研究由純解析模型走向台架與非侵入式自然降速量測；磁軸承研究則將永磁偏置、鐵損、銅損與控制功耗一起考慮。真正的進展判準是整機待機 kW 與長時間能量保持，不是單一零件摩擦係數。[S10–S12]"),
  h3("健康、疲勞與陣列調度"),
  p("疲勞壽命感知 MPC、陣列健康調用與兩階段功率分配，顯示控制對象從一台飛輪擴大到整站資產。研究下一步需要把線上健康估計與維護決策連起來，並以實際振動、溫度、故障和任務譜校準。[S16][S50–S52]"),
  h3("混合儲能由濾波走向衰退導向"),
  p("早期混合控制多以低通濾波把高頻功率交給飛輪；近期研究加入 SOC 約束、自適應分配、模糊 PI 與電池衰退成本。評估重點從『曲線比較平滑』轉向『電池是否少吞吐、少高倍率、少深度循環，且混合系統仍能完成調度』。[S18–S20]"),
  h2("5.3 尚未解決的證據缺口"),
  bullet("複材長期老化：濕熱、真空、輻照、熱循環與輪轂界面在多年任務譜下的公開資料不足。"),
  bullet("圍堵與事故資料：全尺寸爆裂、相鄰機組碎片隔離與消防／救援程序缺少可公開比較的資料庫。"),
  bullet("長期待機與可用率：廠商常給峰值效率與設計壽命，較少公開逐年站用電、停機原因與維護工時。"),
  bullet("第三方經濟性：缺少同一市場、同一任務譜下純鋰電、純飛輪與混合系統的 LCOS／收益對照。"),
  bullet("氫能實證：大型電解槽與飛輪的直接耦合仍以模擬、微電網示範與概念設計為主。"),

  h1("6. 專利版圖與權利狀態"),
  h2("6.1 技術分群"),
  p("代表性樣本顯示，早期壁壘集中在轉子、軸承、真空與電機；近年中國申請則明顯增加陣列調用、構網耦合、健康度、混合功率分配與特殊供電場景。專利數量不能直接代表產品性能，申請公開也不代表已授權或仍有效。[S45–S58][S77–S86]"),
  table(["分群","代表專利／申請人","技術訊號","盡調含義"],[
    ["轉子與接合","US12078221B2；US11362558B2；US9267570B2","複材纏繞、疊片鋼、輪轂界面","需看權利項是否覆蓋具體材料、幾何與製程，而非只看名稱"],
    ["磁軸承","US9892839B2；CN108869543B；CN122678386A","磁卸載、超導、電機磁路整合","部分舊案可能終止；新案多仍在審查"],
    ["真空與熱","US11085420B2；US11271452B2；CN108900039B","密封、分子泵、輻射／熱管散熱","與待機損耗及維護直接相關，值得做家族與引用追查"],
    ["電機與變流","US11682943B2；CN122419082A；CN122338713A","分壓電機、高速整合、高壓直流","要把電磁、機械與控制權利項分開分析"],
    ["陣列與構網","US10693342B2；CN120357630A；CN122512415A；CN122823458B","地埋陣列、網路、健康調用、風電構網耦合","系統整合與軟體控制成為差異化，但易涉及多屬地主權項"],
    ["混合與氫能","CN122697432A；CN116040917A","電池損傷分配、飛輪增量制氫","顯示研發方向，不是商業部署證據"]
  ],[1500,2650,2470,2740],{fontSize:16}),
  h2("6.2 代表專利清單"),
  table(["公開號／主題","申請人／狀態","技術重點與限制","來源"],patents.map(x=>[`${x[0]}｜${x[1]}`,`${x[2]}｜${x[3]}`,x[4],`[${x[5]}]`]),[2300,2000,4310,750],{fontSize:15}),
  h2("6.3 法律狀態與 FTO 邊界"),
  bullet("CN108869543B 於 2024 年因未繳年費終止，是『曾授權但現不一定可主張權利』的例子；是否可自由實施仍要檢查同族與其他有效權利。[S80]"),
  bullet("CN122823458B 於 2026-10-27 授權；多件 2026 新案仍處實質審查，權利範圍可能改變。[S46][S47][S50]"),
  bullet("本報告是代表性抽樣，未覆蓋所有國家、同族、延續案、分案、轉讓、質押、無效與訴訟。正式產品開發需由專利律師依目標市場做 FTO。")
);


children.push(
  pageBreak(),
  h1("7. 全球廠商與產品"),
  h2("7.1 產業版圖"),
  p("全球供應商可分為四群：關鍵電力／UPS、電網調頻模組、長時能量型與新創混合方案。公司存續、產品可訂購、場站運轉與原始技術團隊是四件不同的事；Beacon、Temporal Power 等案例顯示，資產與 IP 可能轉移，不能沿用舊公司名稱推定現今供應責任。[S64–S67]"),
  table(["廠商／組織","定位與代表產品","商業狀態判讀","採購提醒"],[
    ["Active Power／Piller（Langley）","CleanSource、POWERBRIDGE；關鍵電力與 UPS","成熟產品線與全球服務體系","按負載、旁路、發電機與維護界面驗收，不只看飛輪本體"],
    ["VYCON／Calnetix","VDC 系列直流母排飛輪","成熟 UPS 儲能產品","kW·s 與單程效率不可直接和 AC 系統比"],
    ["Beacon Power／場站資產方","Gen4、Stephentown／Hazle","既有 20 MW 電站有商轉證據；原公司歷經破產與資產分拆","確認備件、控制軟體、保固與實際簽約主體"],
    ["Stornetic","DuraStor、EnWheel","分鐘級高功率模組，商業產品","動能與有效能量分列；要求場站全年輔機數據"],
    ["Amber Kinetics","M32 長時鋼轉子","小規模商業部署與長時差異化","DC RTE、4 h 額定與項目利用率需分開核算"],
    ["Torus","Nova Spin＋LFP 混合","以混合方案銷售，飛輪額定功率未完整公開","要求拆分飛輪與電池性能、保固和控制責任"],
    ["Revterra","S100 被動磁浮／超導穩定","早期商業化，開發方規格","50 W 待機等數字需第三方與長時實測"],
    ["Energiestro","VOSS 混凝土＋玻纖轉子","beta／試量產階段","重點在材料老化、製造一致性與圍堵，不宜直接與成熟產品同級"],
    ["QuinteQ","Boeing 授權超導磁浮模組","初期商業部署","冷卻、待機與維護體系需納入整機評估"],
    ["中國供應商群","瀋陽微控、泓慧、坎德拉、華馳、貝肯等","大功率、調頻與 UPS 工程化加速","以場站性能與服務能力驗證，不以工商資本或專利數排名"]
  ],[1800,2450,2450,2660],{fontSize:16}),
  h2("7.2 代表產品規格"),
  table(["產品","功率／能量","額定時間","規格與成熟度判讀","來源"],products.map(x=>[x[0],`${x[1]}｜${x[2]}`,x[3],x[4],`[${x[5]}]`]),[1900,1880,1120,3710,750],{fontSize:15}),
  small("註：放電時間多為額定點或由公開功率／能量核算；UPS 實際 ride-through 隨負載變化。所有廠商效率、循環與壽命均需以採購邊界與第三方測試確認。"),
  ...figure("03_hybrid_power_split.png",580,"圖 7-1　飛輪與鋰電的功率分工示意","來源：本報告合成訊號；非任何專案實測。"),
  h2("7.3 產品解讀案例"),
  h3("Stornetic：同一產品頁有動能與有效能量"),
  p("DuraStor 240 公開 16 kWh 動能與 9.2 kWh 有效能量，DuraStor 1000 則為 64 與 37 kWh。這正說明比較產品時要選擇可交付能量，而非較大的動能數字；其典型 RTE 亦標示含輔機，口徑相對清楚。[S24]"),
  h3("Active Power／VYCON：UPS 不是能量搬移產品"),
  p("UPS 飛輪以短時高功率橋接、發電機啟動與電能品質為核心，應看切換、旁路、負載階躍與維護，不應因 kWh 小就判定技術低階。Active Power 的 MJ、VYCON 的 kW·s 需先換算，再回到負載曲線。[S26][S73]"),
  h3("Amber／Revterra／Energiestro：長時路線不能用成熟度一筆帶過"),
  p("Amber M32 的 4 h 定位與常見秒級飛輪不同；Revterra 與 Energiestro 則以新材料或磁浮路線降低成本與待機。技術可行性、第三方測試、量產能力與場站運轉年數必須分開評估。[S28][S61][S62]"),

  h1("8. 中國企業與產業化"),
  h2("8.1 工商與技術定位"),
  p("中國產業化已由研究機構與示範機組走向 30 MW 獨立調頻、混合儲能與中壓 UPS。下表的存續與註冊資本為天眼查 2026-10-30 查詢結果，只用於主體識別；不能代替財務、訴訟、履約或產品驗收。[S45]"),
  table(["企業","狀態／註冊資本","成立","技術與風險判讀"],companies.map(x=>[x[0],`${x[1]}｜${x[2]}`,x[3],x[4]]),[2750,1900,1250,3460],{fontSize:16}),
  h2("8.2 產業化的三個判準"),
  bullet("從單機參數到站級性能：30 MW 陣列需要功率分配、故障隔離、備件與集控，不是單機 kW 的簡單相加。"),
  bullet("從併網到商轉：全容量併網、一次調頻測試、性能驗收、正式投運與市場結算是不同里程碑；報告逐案保留原有用詞。"),
  bullet("從設備到服務：磁軸承、真空與控制軟體需要長期運維，應確認服務據點、備件交期、軟體更新與資料所有權。"),
  h2("8.3 政策與市場邊界"),
  p("中國新型儲能政策與 2025–2027 規模化建設行動提供市場環境，但飛輪能否取得收益仍取決於各省輔助服務、現貨與容量規則。政策把『新型儲能』作為大類，不代表每一種飛輪路線都有固定補貼或保障收益。[S33][S68]"),

  h1("9. 專案證據與應用成熟度"),
  h2("9.1 代表專案"),
  table(["地點／規模","架構／狀態","可支持的結論與限制","來源"],projects.map(x=>[`${x[0]}｜${x[1]}`,`${x[2]}｜${x[3]}`,x[4],`[${x[5]}]`]),[2450,2000,4160,750],{fontSize:15}),
  ...figure("04_application_maturity.png",570,"圖 9-1　應用成熟度：商業、示範與模擬必須分開","來源：本報告依產品與專案證據整理；成熟度為定性判斷。"),
  h2("9.2 不同應用的成熟邏輯"),
  table(["應用","2026 判斷","商業價值來源","關鍵風險"],[
    ["UPS／關鍵電力","成熟商業","避免停機、減少電池維護、發電機橋接、電能品質","負載匹配、旁路與發電機控制、定期軸承維護"],
    ["電網調頻","已有商業場站","里程／性能、快速響應、高循環下低衰退","市場規則、待機電費、SOC 恢復與可用率"],
    ["工業電能品質／再生制动","商業與項目型","削峰、電壓支撐、能量回收、減少設備衝擊","負載譜不明、併網保護與投資回收"],
    ["飛輪＋鋰電","多國商業部署","高頻與長時分工、降低電池高倍率與吞吐","控制複雜、額外變流與站控、壽命收益需實證"],
    ["小時級純飛輪","早期商業／小規模","長壽命、深度循環、溫度適應與安全差異化","初始成本、待機、案場複製與長期實績"],
    ["飛輪＋氫能","示範／模擬為主","平滑再生能源、支撐電解槽與微電網故障","低系統效率、控制耦合、缺少大型實證"]
  ],[1800,1800,2880,2880]),
  h2("9.3 中國專案時間線"),
  bullet("2022：朔州熱電 5 MW/5 MWh LFP＋2 MW/0.4 MWh 飛輪，作為早期火儲聯合調頻示範。[S34]"),
  bullet("2024：鼎輪長治 30 MW、120 台飛輪併網，提供純飛輪大陣列工程證據。[S32][S74]"),
  bullet("2026：文水全容量併網；綿陽港旗一期出現完成併網、一次調頻測試與商轉報導。兩案證據層級不同，不能只用『投運』概括。[S35][S36]"),

  h1("10. 飛輪＋鋰電混合儲能"),
  h2("10.1 為什麼要混合"),
  p("鋰電適合小時級能量，但高頻充放、高倍率與頻繁 SOC 擺動會增加吞吐與衰退；飛輪可吸收秒級、雙向、高循環分量。混合系統的目標不是讓飛輪取代電池容量，而是用較小的飛輪能量改變電池任務譜，讓兩者都在較適合的區間運作。[S18–S20]"),
  h2("10.2 三種常見架構"),
  table(["架構","連接方式","優勢","控制／驗收重點"],[
    ["交流耦合","飛輪與電池各自 PCS，在交流母線併聯","改造彈性、供應商界面清楚、故障隔離容易","站控時延、無功協調、輔機與雙 PCS 效率"],
    ["共直流母排","兩者接同一 DC link，再共用網側變流器","減少部分功率級、便於快速功率分配","直流保護、故障穿越、電壓窗口與供應商責任"],
    ["UPS／直流負載耦合","飛輪接直流母排，電池或發電機提供長時","短時橋接與長時備援分工明確","切換邏輯、接地、保護選擇性與負載階躍"]
  ],[1700,2300,2600,2760]),
  h2("10.3 控制策略由簡到繁"),
  bullet("固定濾波：以低通／高通分解功率；容易實作，但截止頻率固定，未必適應不同市場與 SOC。"),
  bullet("SOC 約束分配：依飛輪轉速與電池 SOC 調整權重，保留充放電裕度，避免高頻分量被吸收後無法持續。"),
  bullet("模型預測與最佳化：同時考慮效率、SOC、調度、溫度與壽命成本；需要準確模型與即時運算。"),
  bullet("衰退導向控制：把電池損傷係數、吞吐量與飛輪疲勞納入目標函數，讓『省電池』可被量化，而非只看功率曲線。[S16][S20][S84]"),
  h2("10.4 專案證據怎麼看"),
  p("荷蘭 Almelo 與 Heerhugowaard 提供飛輪＋鋰電參與 FCR 的商業部署證據；朔州、綿陽與文水則顯示中國由火儲示範走向大型混合獨立儲能。專案方提出的電池壽命改善，需知道基準電池、控制策略、吞吐量與測試期間，不能外推成固定倍率。[S34–S36][S39][S40]"),
  callout("混合系統驗收","至少設置同場純鋰電基準或可信歷史基準，記錄電池等效完整循環、最大／平均 C-rate、SOC 擺幅、溫度、容量與內阻；同時驗證調頻性能與混合 RTE。只展示功率分流圖，不足以證明壽命或經濟收益。")
);


children.push(
  pageBreak(),
  h1("11. 飛輪＋氫能整合"),
  h2("11.1 功能分工"),
  p("風光制氫系統同時有快速電功率波動與長時能量不平衡。飛輪可平滑直流母排、降低電解槽輸入劇烈變化、提供故障瞬間支撐；氫則把能量轉為可長時儲存的化學能。飛輪不能取代儲氫容量，氫系統也不能提供與飛輪相同的次秒高循環響應。[S21–S23]"),
  table(["層級","飛輪任務","氫系統任務","必要控制"],[
    ["次秒至秒","抑制風光與負載快速波動、直流母排支撐","電解槽與燃料電池維持安全動態","電流／轉速控制、功率限幅、母排電壓"],
    ["秒至分鐘","吸收爬坡與短時能量差、爭取設備調整時間","調整電解槽負載、壓縮機與輔機協調","SOC／轉速恢復、最小負載與爬坡約束"],
    ["小時至季節","僅少量長時機型可參與，通常非主體","儲氫、燃料電池或其他氫利用提供長時能量","能量管理、儲氫存量、效率與安全"],
    ["故障與恢復","快速功率、電壓／頻率支撐、隔離後再啟動","避免電解槽危險停車，支援有序恢復","保護聯鎖、黑啟動程序、氫安全與通訊"]
  ],[1500,2600,2600,2660]),
  h2("11.2 現有證據"),
  table(["案例／研究","性質","證據內容","不能外推的結論"],[
    ["Raglan 礦場","2014–2019 微電網示範","風電、200 kW 飛輪、氫與電池整合，飛輪負責快速平滑","不能證明大型電解槽專用配套已商品化"],
    ["Utsira","2004–2010 歷史示範","風氫島嶼微電網含飛輪；公開資料對 5 kW／5 kWh 口徑不一","不適合據此計算效率或現今成本"],
    ["Elkholy et al. 2024","最佳化模擬","模型中燃料電池由 100 kW 降至 30 kW；PEM 電解槽 71.42%、燃料電池 62.14%、含寄生損耗飛輪 46.41%","不是實測電站效率或通用容量比例"],
    ["Baldinelli et al. 2019","rSOC＋飛輪建模","以飛輪補快速爬坡、可逆固體氧化物電池補長時","不能等同近期 PEM 大型項目實績"],
    ["Popova et al. 2025","故障恢復研究","討論大型電解槽設施的儲能支撐與恢復","仍需實際保護、設備動態與併網測試"]
  ],[1800,1700,3200,2660],{fontSize:16}),
  h2("11.3 商業化前的必要驗證"),
  bullet("用電解槽真實最小負載、爬坡、熱待機與衰減模型，而不是理想可變負載電源。"),
  bullet("把壓縮機、純化、冷卻、整流與氫安全輔機納入功率平衡；只算電堆會高估系統收益。"),
  bullet("驗證飛輪 SOC 恢復與低風／低光期間的待機能量，避免飛輪在長時間低功率時先耗盡。"),
  bullet("以電解槽壽命、氫產量、電能品質與故障恢復時間作指標，不只展示直流母排曲線更平滑。"),

  h1("12. 安全、標準與採購驗收"),
  h2("12.1 中國飛輪標準"),
  table(["標準","時間","適用重點","使用方式"],[
    ["GB/T 44933-2024《電力儲能用飛輪儲能系統技術規範》","2024-12-31 發布；2025-07-01 實施","額定放電功率 200 kW 及以上交流併網系統","站級技術要求與測試依據之一"],
    ["GB/T 44934-2024《電力儲能用飛輪儲能單元技術規範》","2024-12-31 發布；2025-07-01 實施","飛輪儲能單元","單機／單元設計、性能與試驗"],
    ["GB/T 46372-2025《飛輪儲能電站調試導則》","2025-10-31 發布；2026-05-01 實施","飛輪儲能電站調試","把併網、調試與驗收程序分階段管理"]
  ],[3500,1900,2100,1860],{fontSize:16}),
  p("國際專案還可能涉及 IEC 62933 系列、IEEE 1547、UL 9540 或 UL 1778。適用性取決於併網、儲能系統或 UPS 的產品邊界與司法管轄區；UL 9540 的電池熱失控要求不能直接當成飛輪完整安全證明，仍需機械超速、圍堵、真空與軸承失效評估。[S44][S69–S72]"),
  h2("12.2 風險矩陣"),
  table(["危險","觸發／後果","設計防線","驗收證據"],[
    ["過速與轉子破裂","控制失效、材料缺陷；高能碎片與結構破壞","材料裕度、獨立超速保護、圍堵與隔離","超速試驗、破壞模式分析、圍堵報告"],
    ["磁軸承失效","位移、摩擦、備援軸承衝擊","備援軸承、受控降速、陣列隔離","斷電／放大器故障測試、落地次數與振動紀錄"],
    ["真空喪失","風損與溫升快速增加","漏率監測、限功率與降速、密封維護","真空故障注入、自然降速與熱平衡"],
    ["電氣故障","直流短路、變流器或絕緣失效","快速保護、選擇性隔離、弧光與接地設計","短路／保護配合、EMC 與絕緣報告"],
    ["控制與通訊","錯誤功率分配、整站擾動","本地安全控制、白名單指令、資料與資安","通訊中斷、時鐘異常、重連與權限測試"],
    ["維護與救援","高速設備、真空與電氣殘能","上鎖掛牌、降速確認、間距與作業程序","SOP、演練、培訓與事故通報流程"]
  ],[1600,2300,2700,2760],{fontSize:16}),
  h2("12.3 採購技術規格書的最小資料集"),
  table(["類別","必需要求","判定方式"],[
    ["功率與能量","持續／短時功率、有效能量、轉速窗口、放電截止、併網點定義","額定與部分負載測試；禁止只交最高轉速動能"],
    ["效率與待機","AC-AC／DC-DC 邊界、輔機清單、24／72 h 能量保持、四季站用電","分路計量與第三方測試，至少 30 天連續數據"],
    ["動態與電網","反應／上升時間、一次調頻、AGC、無功、構網與故障穿越","實際指令與故障錄波，不用控制模擬代替"],
    ["機械安全","材料、疲勞、超速、圍堵、備援軸承、真空與熱","設計審查＋型式試驗＋現場故障注入"],
    ["可靠與維護","可用率、MTBF／MTTR、維護間隔、備件、軟體與遠端服務","既有場站工單、服務 SLA、備件交期與保固條款"],
    ["混合控制","功率分配、SOC 恢復、純鋰電基準、衰退與效率","同場 A/B 或經校準歷史基準，原始數據可稽核"]
  ],[1600,4680,3080],{fontSize:16}),

  h1("13. 2027–2031 發展情境"),
  h2("13.1 預測原則"),
  p("以下為情境分析，不是市場承諾。核心驅動包括 AI 資料中心與關鍵電力、再生能源占比與頻率服務需求、混合儲能控制、待機損耗與圍堵實證、標準與融資可接受度。未採用未核實的單一市場 CAGR 作為結論。"),
  table(["情境","2027–2031 可能演變","觸發條件","主要觀察指標"],[
    ["保守","UPS 穩定；調頻維持區域型；混合以項目制為主；長時純飛輪與氫耦合進展慢","市場收益不足、待機高、缺少長期可靠度與融資案例","新場站少、可用率與備件問題、項目收益依賴單一政策"],
    ["基準","UPS、調頻與飛輪－鋰電持續增長；陣列健康調度普及；長時有少量可複製專案","標準落地、混合 A/B 證據增加、站用電下降、服務體系成熟","第三方年度性能、更多商轉驗收、混合電池衰退資料、備件 SLA"],
    ["樂觀","低待機與新材料顯著改善；構網與資料中心形成規模市場；氫耦合出現大型實證","全尺寸安全與多年運轉公開、成本下降、電網與電解槽控制標準化","長時產品多次複製、低待機實測、大型氫項目連續運轉與融資"]
  ],[1250,3100,2450,2560],{fontSize:16}),
  h2("13.2 分年度觀察路線"),
  table(["期間","技術焦點","產業焦點","決策節點"],[
    ["2027","低功耗磁軸承、陣列 SOC／健康分配、標準化測試","中國大型專案由併網轉向性能與收益驗證","是否公開全年可用率、站用電與維護工單"],
    ["2028","衰退導向混合控制、grid-forming 與故障穿越","UPS 與資料中心方案更多，混合系統形成參考設計","中壓 UPS 與構網是否完成第三方負載／故障測試"],
    ["2029","複材老化與圍堵資料累積、長時鋼轉子成本優化","長時純飛輪出現可複製案或維持利基","是否有兩個以上獨立場站達到相同性能"],
    ["2030","多資產 EMS、飛輪－電池－氫協調與市場最佳化","氫耦合可能由微電網走向較大示範","是否以真實電解槽動態與氫安全邊界驗收"],
    ["2031","全生命週期健康與可維修設計成熟","供應商整併、服務與性能保固成為競爭核心","融資是否接受長期性能數據與標準化保固"]
  ],[1200,2800,2700,2660],{fontSize:16}),
  h2("13.3 技術突破的真正判準"),
  bullet("不是『更高轉速』，而是同安全裕度下更高有效能量、較低待機與可製造的一致性。"),
  bullet("不是『更多專利』，而是有效權利、可量產製程、可驗收性能與可維護的系統。"),
  bullet("不是『混合曲線漂亮』，而是同場電池衰退下降、整站效率可接受且市場收益提高。"),
  bullet("不是『氫能整合概念』，而是大型電解槽在真實安全與動態限制下完成連續運轉。"),

  h1("14. 結論與行動建議"),
  h2("14.1 總結"),
  p("飛輪最強的競爭力是高功率、快速響應與高循環耐久，不是低成本長時能量。2026 年可確認的商業主軸是 UPS、電網調頻與飛輪－鋰電混合；長時純飛輪已有差異化產品但規模與公開實績有限；飛輪－氫能則仍以微電網示範和模擬為主。"),
  p("技術評估應從任務譜開始：每秒功率如何變、每天多少循環、需要多少分鐘或小時、允許多少待機、故障時如何安全降速。確定任務後，再比較轉子、軸承、真空、電機與控制，才能避免被單一 rpm、效率或 kWh 數字誤導。"),
  h2("14.2 建議的 90 天盡調流程"),
  table(["階段","工作","輸出","通過條件"],[
    ["第 1–2 週","建立負載／調頻任務譜與收益邊界","1 秒或更細功率資料、循環與待機統計","能計算所需 kW、kWh 與 SOC 恢復，不用年平均掩蓋峰值"],
    ["第 3–5 週","向 3–5 家供應商發同一資料模板","有效能量、效率地圖、待機、維護、圍堵與案例","口徑一致，缺口與廠商宣稱明確標示"],
    ["第 6–8 週","既有場站與工單核查、技術澄清","可用率、站用電、故障與服務證據","至少一個同任務、同氣候或相近規模的可查證案例"],
    ["第 9–11 週","性能保固與測試方案","FAT／SAT、故障注入、混合 A/B、資料交付","驗收與付款綁定，原始數據可稽核"],
    ["第 12–13 週","全生命週期商業比較","純鋰電、純飛輪、混合三案現金流與風險","收益不重複計算，靈敏度涵蓋市場規則與待機電費"]
  ],[1350,2550,2550,2910],{fontSize:16}),
  h2("14.3 最終建議"),
  bullet("若目標是關鍵電力：優先比較成熟 UPS 供應商的整機與服務，不把飛輪本體當成完整 UPS。"),
  bullet("若目標是調頻：優先取得實際市場訊號與結算規則，再決定純飛輪或混合；以待機和 SOC 恢復做壓力測試。"),
  bullet("若目標是降低鋰電衰退：設計可量測的同場對照，並把電池保固、飛輪維護與混合效率一起納入。"),
  bullet("若目標是氫能：先做電解槽動態與安全邊界，再評估飛輪容量；不要把示範微電網直接放大成商業結論。"),
  bullet("若目標是長時純飛輪：要求多場站、多年、第三方性能與維護資料，並與其他長時技術做同邊界比較。"),

  pageBreak(),
  h1("附錄 A　公式、術語與資料清單"),
  h2("A.1 核心公式"),
  bullet("動能：E＝½Iω²；E 為 J，I 為 kg·m²，ω 為 rad/s。"),
  bullet("轉速窗口可用能量比例：1−(ωmin／ωmax)²。若最低轉速為最高轉速 50%，理想可用比例為 75%。"),
  bullet("理想 SOC：SOC＝(ω²−ωmin²)/(ωmax²−ωmin²)。實際可交付能量仍受功率、溫度與控制裕度限制。"),
  bullet("單位換算：1 kWh＝3.6 MJ＝3,600 kW·s。"),
  h2("A.2 常用術語"),
  table(["術語","本報告含義"],[
    ["FESS","Flywheel Energy Storage System，飛輪儲能系統"],
    ["有效能量","在指定轉速窗口、功率與截止條件下可交付的能量，不等於最高轉速總動能"],
    ["待機損耗","維持轉速與系統就緒所需風損、軸承、真空、冷卻、控制與電機空載損"],
    ["RTE","Round-trip efficiency，往返效率；必須標明 AC／DC 邊界及是否含輔機"],
    ["AGC／FCR","自動發電控制／頻率遏制儲備等頻率服務；各地定義與結算不同"],
    ["grid-forming","變流器建立電壓與頻率參考的控制方式；仍需能量與功率能力支撐"],
    ["FTO","Freedom to Operate，自由實施分析；需逐國、逐權利項法律核查"]
  ],[1800,7560]),
  h2("A.3 向供應商索取的原始資料"),
  bullet("至少 12 個月、1 秒至 1 分鐘解析度的功率指令與實績、轉速／SOC、溫度、真空、振動與輔機功耗。"),
  bullet("所有停機、降額、備援軸承落地、軸承更換、真空恢復與軟體更新工單。"),
  bullet("效率測試原始電表邊界與不確定度；設計壽命、循環與保固的完整前提。"),
  bullet("混合專案的純鋰電基準、等效完整循環、C-rate、溫度、容量／內阻衰退與更換紀錄。"),
  bullet("有效專利清單、授權／審查／終止狀態、同族與權利轉讓；由法律團隊另行核查。"),

  h1("附錄 B　參考資料"),
  small("說明：[Sxx] 為本文內引用編號。網址為研究截點可取得來源；DOI 與官方資料優先。天眼查資料為 2026-10-30 查詢快照，後續狀態可能改變。")
);
for (const [id,title,url] of sources) {
  children.push(para([run(`[${id}] `,{bold:true,color:C.primary,size:17}),link(title,url)],{spacing:{after:80,line:250}}));
}
children.push(
  h1("附錄 C　研究邊界與更新建議"),
  p("本報告為公開資料的廣泛技術掃描與代表性盤點，不是完整市場普查、專利計量或法律意見。建議每六個月更新產品、專案商轉與標準，每年更新專利法律狀態與供應商工商風險；當有新場站公開全年站用電、可用率與衰退資料時，應優先修訂效率、經濟性與混合壽命結論。"),
  callout("一句話收尾","先用任務譜決定需要多少功率、能量與循環，再用同口徑數據選擇純飛輪、飛輪－鋰電或飛輪－氫能；對任何供應商，都把待機、故障降速、圍堵、維護與原始數據交付寫進驗收。")
);

const doc = new Document({
  creator:"Kimi",
  title:"飛輪儲能技術全景報告",
  description:"學術、專利、廠商、產品、專案、鋰電／氫能整合與 2027–2031 情境",
  features:{updateFields:true},
  styles:{default:{document:{run:{font,size:21,color:C.text},paragraph:{spacing:{after:130,line:320}}}}},
  sections:[{
    properties:{page:{size:{width:11906,height:16838},margin:{top:1100,right:1273,bottom:1100,left:1273,header:500,footer:500}}},
    headers:{default:new Header({children:[para(run("飛輪儲能技術全景報告｜研究截點 2026-10-30",{size:16,color:C.muted}),{alignment:AlignmentType.RIGHT,spacing:{after:40},border:{bottom:{style:BorderStyle.SINGLE,size:4,color:C.line,space:2}}})]})},
    footers:{default:new Footer({children:[para(new TextRun({children:[PageNumber.CURRENT],font,size:16,color:C.muted}),{alignment:AlignmentType.CENTER,spacing:{after:0}})]})},
    children
  }]
});
fs.writeFileSync(outputPath,await Packer.toBuffer(doc));
