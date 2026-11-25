import json, html, copy
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.oxml.ns import qn
from lxml import etree
E=6350
D=json.load(open('shapes.json')); N=json.load(open('notes.json'))
prs=Presentation(); prs.slide_width=Emu(1920*E); prs.slide_height=Emu(1080*E)
lay=prs.slide_layouts[6]
def e(v): return Emu(int(round(v*E)))
def rgb(h): return RGBColor.from_string(h.upper())
def line(shape, hexc, w, dash=False, head=False, tail=False):
    ln=shape.line; ln.color.rgb=rgb(hexc); ln.width=e(w)
    if dash: ln.dash_style=MSO_LINE_DASH_STYLE.DASH
    lnx=shape._element.spPr.find(qn('a:ln'))
    if head: etree.SubElement(lnx, qn('a:headEnd'), type='triangle', w='med', len='med')
    if tail: etree.SubElement(lnx, qn('a:tailEnd'), type='triangle', w='med', len='med')
def noline(s): s.line.fill.background()
def rect(sl, x,y,w,h,bg,r=0):
    if w<=0 or h<=0: return None
    kind=MSO_SHAPE.ROUNDED_RECTANGLE if r>0 else MSO_SHAPE.RECTANGLE
    s=sl.shapes.add_shape(kind,e(x),e(y),e(w),e(h))
    if r>0: s.adjustments[0]=min(0.5, r/min(w,h))
    if bg: s.fill.solid(); s.fill.fore_color.rgb=rgb(bg)
    else: s.fill.background()
    s.shadow.inherit=False
    return s
def text(sl, t):
    pad=4
    x=t['x']-(pad/2 if t['al']=='center' else (pad if t['al']=='right' else 0))
    tb=sl.shapes.add_textbox(e(x),e(t['y']),e(t['w']+pad),e(t['h']))
    tf=tb.text_frame; tf.word_wrap=True; tf.auto_size=None
    tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0; tf.vertical_anchor=MSO_ANCHOR.TOP
    paras=[[]]
    for r in t['runs']:
        if r.get('br'): paras.append([])
        else: paras[-1].append(r)
    for i,runs in enumerate(paras):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph()
        p.alignment={'center':PP_ALIGN.CENTER,'right':PP_ALIGN.RIGHT}.get(t['al'],PP_ALIGN.LEFT)
        p.line_spacing=round(t['lh'],2)
        for r in runs:
            if not r['s']: continue
            rn=p.add_run(); rn.text=r['s']; f=rn.font
            f.size=Pt(t['fs']*0.5); f.bold=r['b']; f.color.rgb=rgb(r['c'])
            fam='JetBrains Mono' if t['mono'] else 'Noto Sans TC'; f.name=fam
            rPr=rn._r.get_or_add_rPr(); ea=etree.SubElement(rPr, qn('a:ea')); ea.set('typeface','Noto Sans TC')
            if t['ls']: rPr.set('spc', str(int(t['ls']*0.5*100)))
for sid in N['order']:
    sl=prs.slides.add_slide(lay); d=D[sid]
    sl.background.fill.solid(); sl.background.fill.fore_color.rgb=rgb(d['bg'])
    for s in d['shapes']:
        k=s['t']
        if k=='rect':
            bs=[b for b in s['b'] if b['w']>0 and b['st']!='none' and b['c']]
            if s.get('rp') and s['r']>=min(s['w'],s['h'])/2*0.9:
                sh=sl.shapes.add_shape(MSO_SHAPE.OVAL,e(s['x']),e(s['y']),e(s['w']),e(s['h']))
                if s['bg']: sh.fill.solid(); sh.fill.fore_color.rgb=rgb(s['bg']['hex'])
                else: sh.fill.background()
            else:
                sh=rect(sl,s['x'],s['y'],s['w'],s['h'],s['bg']['hex'] if s['bg'] else None,s['r'])
            if sh is None: continue
            sh.shadow.inherit=False
            if bs:
                base=min(bs,key=lambda b:b['w'])
                uniform=len(bs)==4 and all(b['w']==base['w'] for b in bs)
                line(sh, base['c']['hex'], base['w'], base['st']=='dashed') if (uniform or len(bs)==4) else noline(sh)
                for side,b in zip('TRBL',s['b']):
                    if b['w']>base['w'] or (len(bs)<4 and b in bs):
                        x,y,w,h=s['x'],s['y'],s['w'],s['h']; bw=b['w']
                        geo={'T':(x,y,w,bw),'B':(x,y+h-bw,w,bw),'L':(x,y,bw,h),'R':(x+w-bw,y,bw,h)}[side]
                        a=rect(sl,*geo,b['c']['hex']); noline(a)
            else: noline(sh)
        elif k=='text': text(sl,s)
        elif k=='oval':
            sh=sl.shapes.add_shape(MSO_SHAPE.OVAL,e(s['x']),e(s['y']),e(s['w']),e(s['h'])); sh.shadow.inherit=False
            if s.get('fill'): sh.fill.solid(); sh.fill.fore_color.rgb=rgb(s['fill']['hex'])
            else: sh.fill.background()
            if s.get('stroke'): line(sh,s['stroke']['hex'],s['sw'])
            else: noline(sh)
        elif k=='poly':
            pts=s['pts']
            if len(pts)<2 or not s.get('stroke'): continue
            fb=sl.shapes.build_freeform(e(pts[0][0]),e(pts[0][1]),scale=1.0)
            fb.add_line_segments([(e(a),e(b)) for a,b in pts[1:]],close=False)
            sh=fb.convert_to_shape(); sh.fill.background(); sh.shadow.inherit=False
            line(sh,s['stroke']['hex'],s['sw'],s.get('dash'),head=s.get('ms'),tail=s.get('me'))
    sl.notes_slide.notes_text_frame.text=html.unescape(N['notes'][sid])
# drop unused layouts to save space
master=prs.slide_masters[0]; used={id(lay)}
for l in list(master.slide_layouts):
    if l is not lay:
        rid=[r for r in master.part.rels.values() if r.target_part is l.part][0].rId
        master.slide_layouts.remove(l) if hasattr(master.slide_layouts,'remove') else None
import os
fn=os.environ.get('FN','out.pptx')
prs.save(fn)
import os; print(os.path.getsize(fn))
