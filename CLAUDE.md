# CLAUDE.md：Flywheel × AIDC 專案交接

本檔讓 Claude Code 接續 claude.ai 上的對話（2026-11-02 至 2026-11-25）。先讀完本檔，再看 `README.md` 與 `docs/README.md`。

## 使用者與工作方式

- 使用者：George，換電站 EMS 研發負責人，熟電力電子（PCS、DC/DC）、電池 SOC／SOH、EIS。
- **一律用繁體中文**回覆與撰寫文件。
- 簡潔、工程師取向；先講結論，依價值排序。
- 自主執行、少問確認；但**改動既有簡報的結論或數字前，先說明要改什麼**。
- 檔名要有描述性：日期 YYYY-MM-DD＋主題＋文件類型＋版本。
- 不要提及使用者的中文姓名。
- 引用的模擬數字必須能用 `check_engine.js` 重現；標明「示意模型」，不當廠商數據。

## 專案一句話

AIDC 同步訓練讓負載在 35 ↔ 100 MW 間每秒擺盪，造成 AC 電流漣波（60 ± k·f_iter 間諧波，打到區域模態與軸系扭振）以及 ramp／LVRT 合規問題。提案在 PCC 並聯 80 MW／0.8 MWh 飛輪（160 × 500 kW／5 kWh、GSC 電流環 ≥ 500 Hz），吸收快的部分，電網只看到平均值與慢的部分。主要依據：arXiv 2508.14318、ERCOT NOGRR282。

## Repo 地圖

| 路徑 | 內容 | 怎麼改 |
|---|---|---|
| `docs/01–08`、`glossary.md`、`references.md` | 技術文件 | 直接改 Markdown |
| `slides/source/v1`、`v2` | **簡報原始碼**：`deck.json`（順序與標題）＋`slides/<id>.html`（每頁 1920×1080 的 `<section>`，講稿在 `<aside>`） | 改 HTML 後跑 `slides/tools/build.sh v1\|v2` |
| `slides/v1`、`v2` | 產出：PPTX、PDF、`png/`、逐頁講稿 `README.md` | **不要手改**，由 build.sh 產生 |
| `slides/tools/` | 匯出流程：`render.js`（Playwright 截圖＋講稿）→ `extract.js`（量測形狀）→ `build.py`（python-pptx 產生可編輯 PPTX）→ soffice 轉 PDF → `gen_readme.py` | 需要 Node、Playwright、python-pptx、LibreOffice；字型由 npm 的 @fontsource 提供 |
| `sim/` | 6 個 3D 情境的單一 HTML（`skill/.../prebuilt/` 的副本） | 改 skill 後重組並複製過來 |
| `skill/aidc-flywheel-3d/` | 3D 引擎（`assets/aidc-sim.js`、`aidc-ripple.js`）、設定、腳本 | 見 `skill/aidc-flywheel-3d/SKILL.md`；數字用 `scripts/check_engine.js` 取得 |
| `data/` | 營運風險比較、事故案例 CSV | — |
| `research/flywheel-landscape-2026/`、`research/flywheel-raiba-2026/` | George 另外加入的兩份研究（全球飛輪全景；飛輪 × RAIBA 立項），有自己的 README 與 MANIFEST | **不要動**，除非被要求 |

簡報 HTML 的限制：不可用 `<sub>`（改用全形或 `_`）；文字不可超出 1920×1080；改完 build 後要看 `slides/<v>/png/` 確認版面。

## 常用指令

```bash
# 重建簡報（輸出 PPTX、PDF、png/、README.md）
slides/tools/build.sh v2

# 3D 引擎數字（預設參數應與 skill/aidc-flywheel-3d/references/physics.md 一致）
cd skill/aidc-flywheel-3d
node scripts/check_engine.js --engine sim --kind s1 --seconds 40 --modes none,fw
node scripts/check_engine.js --engine sim --kind s3 --seconds 234 --modes none,burn,fw
node scripts/check_engine.js --engine ripple --kind ripple --seconds 30 --modes none,gpu,fw
node scripts/check_engine.js --engine ripple --kind ramp --seconds 280 --modes none,gpu,fw,hyb --opts '{"ramp":2}'

# 重組 3D 頁並同步到 sim/
python3 scripts/build_all.py --configs configs --out prebuilt && cp prebuilt/*.html ../../sim/
node scripts/smoke_test.js ../../sim/R2-ramp-lvrt.html /tmp/r2.png   # errors 要是 []
```

## 待辦（依優先序）

### 1. v2 簡報兩處修正（已提出，**等 George 點頭**）

起因是 George 的兩個提問：

**a. 第 10 頁 `timescale.html`：BESS 長條下緣畫在 0.1 s，不正確。**電芯本身在 µs–ms 就能響應；限制在 PCS 與控制鏈（商用 BESS 響應規格多在百毫秒級），以及高頻微循環造成的壽命損耗。飛輪的 2 ms 下緣同樣由 PCS 決定。
- 修法：BESS 長條延伸到約 2 ms；0.1 s 以下改成斜線或虛線，並加標注「需高頻寬 PCS；高頻微循環加速老化」。
- 同步修正第 11 頁 `compare.html` 的相關敘述，讓兩頁一致（第 11 頁原本就把 BESS 處理「電流漣波 0.1–60 Hz」標成「可」）。

**b. 第 11 頁 `compare.html`：飛輪欄「容量不衰減」容易被誤解成免維護。**
- 改為「容量不衰減；軸承、真空泵需定期維護」。
- 補一句：飛輪待機損耗約 1%/h，20 年累積損耗比 LFP 多約 11%（S4 示意）。

改完要同步：`docs/03-solution-landscape.md` 的 3.2、3.3 節；重建 v2；更新 `CHANGELOG.md`。

### 2. v1 數字落差（見 `docs/06-simulation.md` §6.5）

目前引擎（步長 1 ms）的結果與 v1 簡報不一致：

| 項目 | v1 簡報 | 目前引擎 |
|---|---|---|
| S1 峰谷差 | 0.7 MW | 約 2.3 MW |
| S1 變化率 | 1.8 MW/s | 約 14 MW/s |
| S3 飛輪超限 | 0 s | 約 29 s |

S3 的 ramp 指標仍是 100 ms 斜率。做法：
1. 把 `aidc-sim.js` 的 S3 改用 1 s 平均 ramp（比照 `aidc-ripple.js` 的 R2，排除故障恢復窗）。
2. 重跑 check_engine，更新 `references/physics.md` 基準表。
3. 更新 v1 第 2、13 頁（`slides/source/v1/slides/summary.html`、`results.html`），以及 `docs/06`、`CHANGELOG`。
4. 重組 `prebuilt/`，複製到 `sim/`。

### 3. 其他

- 部分參考資料缺網址：NERC Level 3 alert、NVIDIA GB300 部落格、Siemens E-STATCOM 簡報、Energies 13, 4441。補齊 `docs/references.md`。
- 台電大型 AI 負載的 ramp、動態範圍、穿越要求：待確認，這直接決定飛輪能量規格（E ≥ ΔP²／2R）。
- GitHub Pages：需 George 在 Settings → Pages 開啟後，`sim/` 才能線上瀏覽。

## 對話中已定案的觀點（回答相關問題時沿用）

- **pu**：per unit（標么值），實際值除以基準值。
- **飛輪 SOH**：容量不衰減，老化在轉子疲勞、軸承、真空、磁鐵、PCS。轉子疲勞以 σ ∝ ω² 做 rainflow＋Miner 計數；AIDC 微循環的 Δσ／σ_max ≈ 0.56%，貢獻可忽略。損耗以 `a + bω + cω²` 線上辨識。整機 SOH 取各安全相關子項的最小值（見 `docs/07`）。
- **營運風險**：鋰電池是化學性風險（延燒、難撲滅、復燃）；飛輪是機械性風險（能量有上限、可圍阻、可監測）。不說飛輪「不會出事」，見 Beacon Stephentown 2011（見 `docs/08`、`data/`）。
- **BESS vs 飛輪的真正差別**在循環壽命，不在響應速度；兩者的快速端都由 PCS 頻寬決定。

## 線上版本（claude.ai，預設私人）

- 名詞詳解（Claude Docs）：https://claude.ai/artifact/F3CghRnkkMCzFKbeGCBkUJ，repo 快照為 `docs/glossary.md`
- 營運風險比較（Claude Sheets）：https://claude.ai/artifact/9BWyJg6WMrz4Z1ZSGkyyjU，repo 快照為 `data/*.csv`

這兩份在 claude.ai 上改過的話，repo 快照不會自動同步。

## Git

- 預設分支 `main`；遠端已更名為 `pcpcchen-coder/Flywheel`（舊網址會轉址）。
- commit 訊息用中文或英文皆可，說清楚改了哪些產出。
