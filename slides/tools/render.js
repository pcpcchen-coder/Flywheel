const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const DECK = path.resolve(__dirname, process.env.DECK || '../deck/project');
const deck = JSON.parse(fs.readFileSync(DECK + '/deck.json', 'utf8'));
const FS = path.resolve(__dirname, 'node_modules/@fontsource');
const css = [400,500,700].map(w=>`${FS}/noto-sans-tc/${w}.css`).concat([400,600,700].map(w=>`${FS}/jetbrains-mono/${w}.css`))
  .map(f=>`<link rel="stylesheet" href="file://${f}">`).join('');
function conn(attrs) {
  const g = n => { const m = attrs.match(new RegExp(n + '="([^"]*)"')); return m ? m[1] : null; };
  const st = g('style') || '';
  const color = (st.match(/color:\s*([^;]+)/) || [,'#4A5562'])[1].trim();
  const w = parseFloat((st.match(/border-width:\s*([\d.]+)/) || [,3])[1]);
  const dash = /border-style:\s*dashed/.test(st) ? `stroke-dasharray="${w*3} ${w*2.5}"` : '';
  const x1=+g('x1'), y1=+g('y1'), x2=+g('x2'), y2=+g('y2'), route=g('route')||'straight', head=g('head')||'end';
  let d = `M${x1} ${y1} L${x2} ${y2}`;
  if (route==='hv') d = `M${x1} ${y1} H${x2} V${y2}`; else if (route==='vh') d = `M${x1} ${y1} V${y2} H${x2}`;
  const id = 'm' + Math.random().toString(36).slice(2,8);
  const ms = head==='end'||head==='both' ? `marker-end="url(#${id})"` : '', mst = head==='both' ? `marker-start="url(#${id}s)"` : '';
  return `<svg style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none"><defs>
<marker id="${id}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 z" fill="${color}"/></marker>
<marker id="${id}s" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0 L10 5 L0 10 z" fill="${color}"/></marker></defs>
<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" ${dash} ${ms} ${mst}/></svg>`;
}
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const notes = {};
  for (const id of deck.order) {
    let h = fs.readFileSync(`${DECK}/slides/${id}.html`, 'utf8');
    const a = h.match(/<aside>([\s\S]*?)<\/aside>/); notes[id] = a ? a[1].trim() : '';
    h = h.replace(/<aside>[\s\S]*?<\/aside>/, '')
         .replace(/<x-connector([^>]*)><\/x-connector>/g, (_, at) => conn(at))
         .replace(/<x-shape kind="ellipse" style="([^"]*)"><\/x-shape>/g, (_, s) => `<div style="${s};border-radius:50%"></div>`);
    const page = `<!doctype html><html><head><meta charset="utf-8">${css}<style>
*{margin:0;box-sizing:border-box} body{width:1920px;height:1080px;overflow:hidden}
section{position:relative;width:1920px;height:1080px;overflow:hidden}
h1{line-height:1.1}h2{line-height:1.15}h3{line-height:1.2}p{line-height:1.4}
table{border-collapse:collapse;width:100%} th,td{padding:.35em .6em;border-bottom:1px solid rgba(22,32,43,.14);text-align:left;vertical-align:top;line-height:1.4} th{font-weight:700}
a{color:#1F64B5}
</style></head><body>${h}</body></html>`;
    const f = path.join(__dirname, 'pages', id + '.html'); fs.writeFileSync(f, page);
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(__dirname, 'png', id + '.png') });
  }
  fs.writeFileSync(path.join(__dirname, 'notes.json'), JSON.stringify({ order: deck.order, notes }, null, 1));
  await b.close(); console.log('done', deck.order.length);
})();
