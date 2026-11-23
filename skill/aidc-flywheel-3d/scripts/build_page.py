#!/usr/bin/env python3
"""Build one self-contained 3D scenario page from a JSON config.

Usage:
  python3 scripts/build_page.py --config configs/R1-current-ripple.json --out out/R1.html
  python3 scripts/build_page.py --config my.json --validate-only

The page inlines three.js r149 + the physics/3D engine, so the output HTML
works offline (only the Google Fonts link needs network; it falls back to system fonts).
Never edit the engine files to change text or layout — edit the config.
"""
import argparse, html, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

KINDS = {
    "sim":    {"s1": ["none", "fw"], "s2": ["ups", "fw"], "s3": ["none", "burn", "fw"], "s4": []},
    "ripple": {"ripple": ["none", "gpu", "fw", "hyb"], "ramp": ["none", "gpu", "fw", "hyb"]},
}
SET_KEYS = {"s1": set(), "s2": set(), "s3": {"ramp"}, "s4": {"kdod", "efcRated"},
            "ripple": {"Titer", "bw", "edge"}, "ramp": {"ramp", "bw"}}
TRIGGERS = {"s2": {None}, "ramp": {"fault", "train", "off", "ckpt"}}
SIDES = {"spec", "lvrt", "text", "none"}
SIDE_OK = {"spec": {"s1", "ripple"}, "lvrt": {"ramp"}}


def validate(c):
    err = []
    for k in ("engine", "kind", "title"):
        if k not in c:
            err.append(f"missing required key: {k}")
    if err:
        return err
    eng, kind = c["engine"], c["kind"]
    if eng not in KINDS:
        return [f"engine must be one of {list(KINDS)}"]
    if kind not in KINDS[eng]:
        return [f"kind '{kind}' not valid for engine '{eng}'; use one of {list(KINDS[eng])}"]
    modes = KINDS[eng][kind]
    side = (c.get("side") or {"type": "none"}).get("type", "none")
    if side not in SIDES:
        err.append(f"side.type must be one of {sorted(SIDES)}")
    elif side in SIDE_OK and kind not in SIDE_OK[side]:
        err.append(f"side.type '{side}' only works with kind {sorted(SIDE_OK[side])}")
    for ri, row in enumerate(c.get("controls", [])):
        if not isinstance(row, list):
            err.append(f"controls[{ri}] must be a list (one row of items)")
            continue
        for it in row:
            t = it.get("type")
            if t not in ("segmented", "cycle", "button"):
                err.append(f"controls[{ri}]: unknown item type {t!r}")
                continue
            if t in ("segmented", "cycle"):
                key = it.get("key")
                if key == "mode":
                    for o in it.get("options", []):
                        if o.get("value") not in modes:
                            err.append(f"mode option {o.get('value')!r} not valid for {kind}; allowed {modes}")
                elif key == "speed":
                    pass
                elif key not in SET_KEYS[kind]:
                    err.append(f"control key {key!r} not supported by {kind}; allowed: mode, speed, {sorted(SET_KEYS[kind])}")
                vals = [o.get("value") for o in it.get("options", [])] if t == "segmented" else it.get("values", [])
                if "default" not in it or it["default"] not in vals:
                    err.append(f"control {key!r}: 'default' must be one of its values {vals}")
            if t == "button" and it.get("action") not in ("pause", "trigger"):
                err.append("button.action must be 'pause' or 'trigger'")
            if t == "button" and it.get("action") == "trigger":
                if kind not in TRIGGERS or it.get("arg") not in TRIGGERS[kind]:
                    err.append(f"trigger not supported for {kind} with arg {it.get('arg')!r}")
    for i, k in enumerate(c.get("kpis", [])):
        if "note" not in k and "value" not in k:
            err.append(f"kpis[{i}] needs 'value' (or be a {{'note': ...}} card)")
    if len(c.get("kpis", [])) > 5:
        err.append("at most 5 kpi cards fit beside the 3D view")
    return err


def build(c, out):
    tpl = open(os.path.join(ROOT, "templates", "page.html"), encoding="utf-8").read()
    three = open(os.path.join(ROOT, "assets", "three.min.js"), encoding="utf-8").read()
    eng = open(os.path.join(ROOT, "assets", "aidc-sim.js" if c["engine"] == "sim" else "aidc-ripple.js"), encoding="utf-8").read()
    cj = json.dumps(c, ensure_ascii=False).replace("</", "<\\/")
    page = tpl.replace("__TITLE__", html.escape(c["title"])).replace("__CONFIG__", cj)
    page = page.replace("/*__THREE__*/", lambda_safe(three)).replace("/*__ENGINE__*/", lambda_safe(eng))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page)
    return len(page)


def lambda_safe(s):
    return s  # plain str.replace is literal; kept as a hook


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--out")
    ap.add_argument("--validate-only", action="store_true")
    a = ap.parse_args()
    try:
        c = json.load(open(a.config, encoding="utf-8"))
    except Exception as e:
        print(f"ERROR: config is not valid JSON: {e}")
        sys.exit(2)
    err = validate(c)
    if err:
        print("ERROR: config problems:\n  - " + "\n  - ".join(err))
        sys.exit(1)
    if a.validate_only:
        print("OK: config valid")
        return
    if not a.out:
        print("ERROR: --out is required unless --validate-only")
        sys.exit(2)
    n = build(c, a.out)
    print(f"OK: wrote {a.out} ({n/1024:.0f} KB)")


if __name__ == "__main__":
    main()
