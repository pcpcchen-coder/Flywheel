#!/usr/bin/env python3
"""Build every config in a folder plus an index.html that links them.

Usage:
  python3 scripts/build_all.py --configs configs --out out --title "飛輪儲能 × AIDC 3D 模擬"
"""
import argparse, glob, html, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))

ap = argparse.ArgumentParser()
ap.add_argument("--configs", default=os.path.join(os.path.dirname(HERE), "configs"))
ap.add_argument("--out", default="out")
ap.add_argument("--title", default="飛輪儲能 × AIDC 動態負載 3D 模擬")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
items = []
for cfgp in sorted(glob.glob(os.path.join(a.configs, "*.json"))):
    name = os.path.splitext(os.path.basename(cfgp))[0]
    try:
        probe = json.load(open(cfgp, encoding="utf-8"))
    except Exception:
        probe = None
    if not isinstance(probe, dict) or not all(k in probe for k in ("engine", "kind", "title")):
        print(f"SKIP: {cfgp} is not a scenario config (needs engine, kind, title)")
        continue
    outp = os.path.join(a.out, name + ".html")
    r = subprocess.run([sys.executable, os.path.join(HERE, "build_page.py"), "--config", cfgp, "--out", outp], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
    if r.returncode != 0:
        sys.exit(r.returncode)
    c = json.load(open(cfgp, encoding="utf-8"))
    items.append((name + ".html", c.get("eyebrow", ""), c["title"], c.get("lede", "")))

cards = "\n".join(
    f'<a class="card" href="{html.escape(f)}"><span class="e">{html.escape(e)}</span><b>{html.escape(t)}</b><span class="l">{html.escape(l[:120])}…</span></a>'
    for f, e, t, l in items)
page = f"""<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(a.title)}</title>
<style>body{{margin:0;background:#0A0E13;color:#E6EAF0;font-family:'Noto Sans TC',system-ui,sans-serif}}
main{{max-width:1100px;margin:0 auto;padding:48px 16px}}h1{{font-size:32px;margin:0 0 24px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}}
.card{{display:flex;flex-direction:column;gap:8px;padding:20px;border:1px solid #1F2A36;border-radius:12px;background:#111821;color:#E6EAF0;text-decoration:none}}
.card:hover{{border-color:#FF9F43}}.e{{font:13px ui-monospace,monospace;color:#FF9F43}}.l{{font-size:13px;line-height:1.6;color:#A7B2BF}}</style></head>
<body><main><h1>{html.escape(a.title)}</h1><div class="grid">{cards}</div></main></body></html>"""
open(os.path.join(a.out, "index.html"), "w", encoding="utf-8").write(page)
print(f"OK: wrote {os.path.join(a.out, 'index.html')} with {len(items)} scenarios")
