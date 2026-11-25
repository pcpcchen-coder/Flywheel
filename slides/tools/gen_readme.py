#!/usr/bin/env python3
"""由 source/<v>/ 產生 slides/<v>/README.md（逐頁標題＋縮圖＋講稿）並整理 png 命名。
用法：python3 gen_readme.py v1|v2   （需先跑 render.js 產生 tools/png/<id>.png）"""
import json, re, html, os, shutil, sys, glob
v = sys.argv[1]; here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, '..', 'source', v); out = os.path.join(here, '..', v)
names = {'v1': '2026-11-02_AIDC飛輪儲能_控制邏輯與導入效益_簡報_v1',
         'v2': '2026-11-02_AIDC電流漣波與ramp-LVRT_飛輪主動電流補償_簡報_v2'}
def clean(t): t = re.sub(r'<[^>]+>', ' ', t); t = html.unescape(t); return re.sub(r'\s+', ' ', t).strip()
dj = json.load(open(os.path.join(src, 'deck.json'), encoding='utf-8'))
os.makedirs(os.path.join(out, 'png'), exist_ok=True)
for f in glob.glob(os.path.join(out, 'png', '*.png')): os.remove(f)
lines = [f"# {dj['title']}（{v}）—逐頁大綱與講稿\n\n",
         f"檔案：[PPTX](./{names[v]}.pptx) · [PDF](./{names[v]}.pdf)\n\n",
         "> 數字來自自建**示意模型**（100 MW AIDC、飛輪 80 MW／0.8 MWh），不是廠商數據。\n"]
for i, s in enumerate(dj['order'], 1):
    t = open(os.path.join(src, 'slides', s + '.html'), encoding='utf-8').read()
    h = re.search(r'<h[12][^>]*>(.*?)</h[12]>', t, re.S); title = clean(h.group(1)) if h else s
    n = re.search(r'<aside>(.*?)</aside>', t, re.S); note = clean(n.group(1)) if n else ''
    png = os.path.join(here, 'png', s + '.png')
    if os.path.exists(png): shutil.copy(png, os.path.join(out, 'png', f'{i:02d}-{s}.png'))
    lines.append(f"\n## {i:02d}. {title}\n\n![{title}](./png/{i:02d}-{s}.png)\n\n**講稿：**{note}\n")
open(os.path.join(out, 'README.md'), 'w', encoding='utf-8').write(''.join(lines))
print('OK README', v, len(dj['order']))
