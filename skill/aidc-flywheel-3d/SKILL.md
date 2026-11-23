---
name: aidc-flywheel-3d
description: 產生「飛輪儲能 × AI 資料中心（AIDC）動態負載」的互動 3D 模擬網頁（單一 HTML）：同步擺盪平滑、電網故障穿越、作業啟停 ramp、20 年壽命、AC 電流漣波、ramp／LVRT 合規。使用者要做 AIDC、GPU 負載擺盪、飛輪、電流漣波、LVRT、ramp 的 3D 示意或模擬頁時使用。
---

# AIDC × 飛輪儲能 3D 模擬頁產生器

這個 skill 已經內建完整的 3D 場景與物理模型（`assets/`）。**你的工作只有：選情境 → 改 JSON 設定 → 跑腳本 → 交付 HTML。** 不要自己寫 three.js、WebGL 或物理公式。

## 鐵則（每一條都要遵守）

1. **不改 `assets/` 與 `templates/`。** 要改文字、按鈕、KPI、參數，一律改 `configs/*.json`（複製一份再改）。
2. **不編造數字。** 寫進頁面（lede、footer、note）或回覆裡的任何模擬數字，都必須來自 `scripts/check_engine.js` 的輸出。沒跑就不寫數字。
3. **每次改完 config 先驗證**：`python3 scripts/build_page.py --config <檔> --validate-only`，出現 ERROR 就照訊息修，修到 `OK` 為止。
4. **一個情境＝一個 config＝一個 HTML。** 輸出是可離線開啟的單一 HTML（約 650 KB，已內嵌 three.js）。
5. 交付時說明這是**示意模型**，並列出主要假設（footer 已有）。

## 情境目錄

| config | engine／kind | 展示什麼 | 模式 |
|---|---|---|---|
| `configs/S1-sync-swing.json` | sim／s1 | GPU 同步擺盪 0.2–3 Hz，飛輪平滑；附功率頻譜 | 無儲能、飛輪 |
| `configs/S2-fault-ride-through.json` | sim／s2 | 230 kV 故障＋重合閘；UPS 轉供脫網 vs 飛輪穿越；區域頻率 | UPS、飛輪 |
| `configs/S3-job-ramp.json` | sim／s3 | 作業啟動／checkpoint／當機的 ramp；GPU 空轉 vs 飛輪 | 無、GPU 地板、飛輪 |
| `configs/S4-lifecycle.json` | sim／s4 | 20 年縮時：LFP 衰減更換 vs 飛輪不衰減，含損耗 | （參數切換） |
| `configs/R1-current-ripple.json` | ripple／ripple | AC 電流漣波：i_grid = i_load − i_fw 波形帶、60 Hz 間諧波頻譜、軸系扭振 | 無補償、GPU 韌體、飛輪 |
| `configs/R2-ramp-lvrt.json` | ripple／ramp | ramp 限值與 LVRT（ERCOT NOGRR282）恢復檢查 | 無、GPU、飛輪、協同 |

`prebuilt/` 有這 6 個情境已組好的 HTML。**如果你沒有執行指令的能力，直接交付 `prebuilt/` 裡對應的檔案即可。**

## 標準流程

**步驟 0　確認環境**：`python3 --version` 和 `node --version` 都要能跑。不能跑 → 交付 `prebuilt/`，結束。

**步驟 1　選情境**：依使用者需求從上表挑一或多個。不確定時：講「擺盪／平滑」→ S1；「故障／脫網／穿越」→ S2；「啟停／ramp」→ S3 或 R2；「壽命／鋰電比較」→ S4；「電流漣波／間諧波／諧波／扭振」→ R1；「LVRT／grid code」→ R2。

**步驟 2　複製並修改 config**：

```bash
mkdir -p work out
cp configs/R1-current-ripple.json work/R1.json
```

只改使用者要求的部分。常改的欄位：`title`、`eyebrow`、`lede`、`kpis[].label`、`legend`、`footer`、控制項的 `default` 與 `options`、`engineOpts`。欄位規格見 `references/config-schema.md`；KPI 能用的欄位名稱見 `references/kpi-fields.md`。

**步驟 3　驗證**：

```bash
python3 scripts/build_page.py --config work/R1.json --validate-only
```

**步驟 4　取得數字（要寫數字時必做）**：

```bash
node scripts/check_engine.js --engine ripple --kind ripple --seconds 30 --modes none,gpu,fw
```

秒數建議：s1 40、s2 8、s3 234、s4 5、ripple 30、ramp 280。若改了 `engineOpts`，把**整個** engineOpts 原樣傳給 `--opts`（巢狀結構不要攤平），例如：

```bash
node scripts/check_engine.js --engine ripple --kind ripple --seconds 30 --modes none,fw \
  --opts '{"Titer":1.4,"bw":500,"fw":{"Pmax":60,"Euse":0.6}}'
```

預設參數的結果應與 `references/physics.md` 的基準表一致，不一致就是參數傳錯了。寫進 lede 的數字要註明「穩態 N 秒模擬」（N＝你用的秒數）：網頁上的即時 KPI 是滑動視窗，開頁後約 20–30 秒才會穩定到相同數值，前幾秒不同是正常的。

`check_engine` 的輸出請存到 `work/checks/` 或其他資料夾，**不要放在 config 資料夾裡**。

**步驟 5　組頁**：

```bash
python3 scripts/build_page.py --config work/R1.json --out out/R1.html
# 多個情境＋索引頁：
python3 scripts/build_all.py --configs work --out out --title "專案名稱"
```

**步驟 6　檢查（有 Playwright 才做）**：

```bash
node scripts/smoke_test.js out/R1.html out/R1.png
```

`errors` 要是空陣列，`kpis` 不能全是「—」。如果輸出是 `SKIP: playwright not installed`，代表**沒有檢查**，不是通過——在交付時說明「未做瀏覽器檢查」。有截圖就看一眼：3D 畫面有園區、KPI 卡有數字、下方有曲線。

**步驟 7　交付**：給出 HTML 檔路徑，並用 3–5 行說明：用 Chrome／Edge 開啟；拖曳 3D 旋轉、雙擊復位；上方按鈕切換模式與參數；這是示意模型（列出 footer 的關鍵假設）；引用的數字來自步驟 4。

## 常見需求怎麼改

| 需求 | 做法 |
|---|---|
| 改標題、文字 | 改 `title` `eyebrow` `lede` `legend` `kpis[].label/sub` `side.lines` `footer`、控制項的 `label` 與 `options[].label`。不要改 `value` 裡的 `{欄位}` 名稱。英文標題約 55 個字元內 |
| 改語言（如英文） | 上一列的欄位都可翻譯；但 **3D 畫面上的標籤與下方圖表的標題、圖例是寫死在 `assets/` 的中文**，不能經由 config 修改。交付時要說明這一點，不要改 assets |
| 預設停在某個模式 | 改 mode 控制項的 `default`，同時改 `engineOpts.mode` |
| 拿掉某個模式按鈕 | 從 `options` 刪掉；`default` 要仍在剩下的選項裡 |
| 改飛輪容量 | `engineOpts.fw = { "Pmax": 60, "Euse": 0.6 }`（MW、MWh）；更新 footer 文字；重跑步驟 4。注意：功率只要大於擺盪所需（約 25–66 MW，視情境），漣波結果幾乎不變——這是正確結果，照實寫「在此容量下結果不受影響」；能量（Euse）主要影響 ramp 情境與 SoE |
| 改 GPU 擺盪週期 | R1：改 `Titer` 控制項選項或 `engineOpts.Titer`；其他 sim 情境：`engineOpts.load.Titer` |
| 改 ramp 限值選項 | 改 ramp 控制項的 `options`（MW/s；20 MW/min 寫 0.3333） |
| 加一張 KPI 卡 | 從 `kpi-fields.md` 挑欄位；最多 5 張；格式寫法見 `config-schema.md` |
| 合格／不合格變色 | 在卡片加 `cases`，例如 `{"if":[{"f":"imax","op":">","v":1.25}],"color":"#FF8A8A"}` |
| 要一頁看多個情境 | 每個情境各一個 config，用 `build_all.py` 產生 `index.html` |

改 `engineOpts.load` 時，`base + gpuPeak` 請 ≤ 105（MW），否則圖表會出界；更大的廠區請在文字中用「每 100 MW」呈現。

## 錯誤排除

- `ERROR: config problems` → 照列出的訊息改（常見：mode 值打錯、`default` 不在 options、在不支援的 kind 用了 `side.type`）。
- KPI 顯示「—」→ `{欄位}` 名稱打錯，對照 `kpi-fields.md`；R2 的恢復時間在第一次故障（約第 100 秒）前本來就是「—」。
- 3D 畫面全黑 → 瀏覽器停用了 WebGL；改用 Chrome／Edge，或開啟硬體加速。
- 字型不同 → 離線時拿不到 Google Fonts，會改用系統字型，不影響功能。

## 檔案結構

```
SKILL.md
assets/        three.min.js（r149）、aidc-sim.js（S1–S4）、aidc-ripple.js（R1–R2）——不要改
templates/     page.html——不要改
configs/       6 個情境的範本 config——複製後再改
scripts/       build_page.py、build_all.py、check_engine.js、smoke_test.js
references/    config-schema.md、kpi-fields.md、physics.md（模型與基準結果）
prebuilt/      6 個已組好的 HTML
```
