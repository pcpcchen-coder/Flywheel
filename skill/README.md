# aidc-flywheel-3d skill

讓其他模型（原始目標：qwen3.8-27b-fp8）產生與本專案相同的 3D 模擬頁。模型只需「選情境 → 改 JSON 設定 → 跑腳本 → 交付 HTML」，不必自己寫 three.js 或物理公式。

- 主說明：[aidc-flywheel-3d/SKILL.md](./aidc-flywheel-3d/SKILL.md)
- 設定規格：[references/config-schema.md](./aidc-flywheel-3d/references/config-schema.md)
- KPI 欄位：[references/kpi-fields.md](./aidc-flywheel-3d/references/kpi-fields.md)
- 模型與基準結果：[references/physics.md](./aidc-flywheel-3d/references/physics.md)

## 快速開始

需要 Python 3 與 Node.js（瀏覽器檢查另需 Playwright，可選）。

```bash
cd skill/aidc-flywheel-3d
# 驗證並組出單一情境
python3 scripts/build_page.py --config configs/R1-current-ripple.json --validate-only
python3 scripts/build_page.py --config configs/R1-current-ripple.json --out out/R1.html
# 全部情境＋索引頁
python3 scripts/build_all.py --configs configs --out out --title "飛輪儲能 × AIDC 3D 模擬"
# 取得穩態數字（寫進文字前必做）
node scripts/check_engine.js --engine ripple --kind ripple --seconds 30 --modes none,gpu,fw
# 瀏覽器煙霧測試（可選）
node scripts/smoke_test.js out/R1.html out/R1.png
```

## 結構

```
aidc-flywheel-3d/
  SKILL.md       使用流程與鐵則
  assets/        three.min.js（r149）、aidc-sim.js（S1–S4）、aidc-ripple.js（R1–R2）
  templates/     page.html（設定驅動的頁面模板）
  configs/       6 個情境範本
  scripts/       build_page.py、build_all.py、check_engine.js、smoke_test.js
  references/    config-schema.md、kpi-fields.md、physics.md
  prebuilt/      6 個已組好的 HTML＋index.html
```

`out/`、`work/` 為產出資料夾，已列入 `.gitignore`。
