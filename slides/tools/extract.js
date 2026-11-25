const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
// reuse render.js page builder by requiring its pieces: simpler to re-render from tmp pages saved per slide
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
 const {order}=JSON.parse(fs.readFileSync('notes.json','utf8'));const out={};
 for(const id of order){
  await p.goto('file://'+path.resolve('pages',id+'.html'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
  out[id]=await p.evaluate(()=>{
   const S=document.querySelector('section'),R0=S.getBoundingClientRect(),shapes=[];
   const col=c=>{const m=c&&c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(',').map(Number);if(v.length>3&&v[3]===0)return null;return {hex:v.slice(0,3).map(x=>Math.round(x).toString(16).padStart(2,'0')).join(''),a:v.length>3?v[3]:1};};
   const box=r=>({x:r.left-R0.left,y:r.top-R0.top,w:r.width,h:r.height});
   const TEXT=new Set(['H1','H2','H3','P','TD','TH']);
   function painted(el,cs){const bg=col(cs.backgroundColor);const bw=['Top','Right','Bottom','Left'].map(s=>({w:parseFloat(cs['border'+s+'Width'])||0,c:col(cs['border'+s+'Color']),st:cs['border'+s+'Style']}));
     const grad=cs.backgroundImage&&cs.backgroundImage!=='none';
     if(!bg&&!bw.some(b=>b.w>0&&b.st!=='none'))return;
     shapes.push({t:'rect',...box(el.getBoundingClientRect()),bg,b:bw,r:parseFloat(cs.borderTopLeftRadius)||0,rp:cs.borderTopLeftRadius.includes('%')});}
   function runs(el){const rs=[];(function walk(n,st){for(const c of n.childNodes){if(c.nodeType===3){if(c.textContent.replace(/\s+/g,'')!==''||c.textContent===' ')rs.push({s:c.textContent.replace(/\s+/g,' '),...st});}
     else if(c.nodeType===1){if(c.tagName==='BR'){rs.push({br:1});continue;}const cs=getComputedStyle(c);walk(c,{b:parseInt(cs.fontWeight)>=600,c:col(cs.color).hex});}}})(el,{b:parseInt(getComputedStyle(el).fontWeight)>=600,c:col(getComputedStyle(el).color).hex});
     if(rs.length&&rs[0].s)rs[0].s=rs[0].s.replace(/^ /,'');const l=rs[rs.length-1];if(l&&l.s)l.s=l.s.replace(/ $/,'');return rs;}
   function svgShapes(svg){const sr=svg.getBoundingClientRect(),ox=sr.left-R0.left,oy=sr.top-R0.top;const vb=svg.viewBox&&svg.viewBox.baseVal&&svg.viewBox.baseVal.width?svg.viewBox.baseVal:null;const sx=vb?sr.width/vb.width:1,sy=vb?sr.height/vb.height:1;
     svg.querySelectorAll('path,circle').forEach(e=>{if(e.closest('marker'))return;const cs=getComputedStyle(e);const st={stroke:col(cs.stroke),sw:(parseFloat(e.getAttribute('stroke-width'))||1)*sx,dash:!!e.getAttribute('stroke-dasharray'),fill:col(cs.fill),op:parseFloat(e.getAttribute('opacity')||1),me:!!e.getAttribute('marker-end'),ms:!!e.getAttribute('marker-start')};
      if(e.tagName==='circle'){const cx=+e.getAttribute('cx'),cy=+e.getAttribute('cy'),r=+e.getAttribute('r');shapes.push({t:'oval',x:ox+(cx-r)*sx,y:oy+(cy-r)*sy,w:2*r*sx,h:2*r*sy,...st});return;}
      const toks=e.getAttribute('d').match(/[MLHVZz]|-?[\d.]+/g);let x=0,y=0,cmd,polys=[],cur=null;
      for(let i=0;i<toks.length;){const t=toks[i];if(/[A-Za-z]/.test(t)){cmd=t;i++;if(cmd==='Z'||cmd==='z'){if(cur)cur.push(cur[0]);continue;}}
       if(cmd==='M'){x=+toks[i++];y=+toks[i++];cur=[[x,y]];polys.push(cur);cmd='L';}else if(cmd==='L'){x=+toks[i++];y=+toks[i++];cur.push([x,y]);}else if(cmd==='H'){x=+toks[i++];cur.push([x,y]);}else if(cmd==='V'){y=+toks[i++];cur.push([x,y]);}else i++;}
      polys.forEach(pl=>shapes.push({t:'poly',pts:pl.map(([a,c])=>[ox+a*sx,oy+c*sy]),...st}));});}
   (function walk(el){for(const c of el.children){const cs=getComputedStyle(c);if(cs.display==='none')continue;
     if(c.tagName==='svg'||c.tagName==='SVG'){svgShapes(c);continue;}
     if(c.tagName==='TR'){const bg=col(cs.backgroundColor);const r=box(c.getBoundingClientRect());if(bg)shapes.push({t:'rect',...r,bg,b:[],r:0});shapes.push({t:'poly',pts:[[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]],stroke:{hex:'d5d9d3',a:1},sw:1});}
     else painted(c,cs);
     if(TEXT.has(c.tagName)){const r=c.getBoundingClientRect(),pl=parseFloat(cs.paddingLeft),pt=parseFloat(cs.paddingTop),pr=parseFloat(cs.paddingRight),pb=parseFloat(cs.paddingBottom);
       shapes.push({t:'text',x:r.left-R0.left+pl,y:r.top-R0.top+pt,w:r.width-pl-pr,h:r.height-pt-pb,fs:parseFloat(cs.fontSize),lh:parseFloat(cs.lineHeight)/parseFloat(cs.fontSize),mono:/JetBrains/.test(cs.fontFamily),al:cs.textAlign,ls:parseFloat(cs.letterSpacing)||0,runs:runs(c)});continue;}
     walk(c);}})(S);
   const bg=col(getComputedStyle(S).backgroundColor);return {bg:bg.hex,shapes};});
 }
 fs.writeFileSync('shapes.json',JSON.stringify(out));await b.close();console.log('ok');})();
