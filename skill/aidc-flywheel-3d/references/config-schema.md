# Config 完整規格

一個 config（JSON）＝一個 3D 情境頁。`scripts/build_page.py` 會檢查並組成單一 HTML。

## 頂層欄位

| 欄位 | 必填 | 說明 |
|---|---|---|
| `engine` | ✔ | `"sim"`（v1：S1–S4）或 `"ripple"`（v2：R1、R2） |
| `kind` | ✔ | sim：`s1` `s2` `s3` `s4`；ripple：`ripple` `ramp` |
| `title` | ✔ | 頁面大標題（一行：中文約 30 字、英文約 55 字元內） |
| `eyebrow` |  | 標題上方小字（例「情境 01 · …」） |
| `lede` |  | 標題下說明，2–3 句，約 150 字內 |
| `viewAlt` |  | 3D 畫面的無障礙描述 |
| `controls` |  | 控制列；陣列的陣列（每個內層陣列＝一列） |
| `status` |  | 3D 畫面角落的狀態牌 |
| `legend` |  | 3D 畫面左下角圖例 |
| `kpis` |  | 右側 KPI 卡，最多 5 張 |
| `side` |  | 下方右側面板：`spec`、`lvrt`、`text`、`none` |
| `footer` |  | 頁尾假設說明（寫清楚示意參數） |
| `sources` |  | `[{ "label", "url" }]`，頁尾「依據」連結 |
| `engineOpts` |  | 傳給引擎的初始參數（見下） |

## 每種 kind 允許的值

| kind | mode 值 | 可 set 的 key | trigger | side 可用 |
|---|---|---|---|---|
| s1 | `none` `fw` | — | — | spec、text、none |
| s2 | `ups` `fw` | — | 不帶 arg（觸發故障） | text、none |
| s3 | `none` `burn` `fw` | `ramp` | — | text、none |
| s4 | （無模式） | `kdod` `efcRated` | — | text、none |
| ripple | `none` `gpu` `fw` `hyb` | `Titer` `bw` `edge` | — | spec、text、none |
| ramp | `none` `gpu` `fw` `hyb` | `ramp` `bw` | `fault` `train` `off` `ckpt` | lvrt、text、none |

所有 kind 都可用 `speed`（模擬速度倍率）。

## engineOpts

- 共通：`mode`、`speed`
- s3、ramp：`ramp`（MW/s，0.3333＝20 MW/min）
- ripple：`Titer`（迭代週期 s）、`bw`（PCS 電流環頻寬 Hz）、`edge`（GPU 邊緣時間常數 s，預設 0.005）
- s4：`kdod`（淺循環折減 0–1）、`efcRated`（LFP 額定等效循環）
- 進階（改設備參數，改了要更新 footer 並重跑 check_engine）：
  - `fw`：`{ "Pmax": 80, "Euse": 0.8, "rpmMin": 7500, "rpmMax": 15000, "eta": 0.955, "standby": 0.01 }`（MW、MWh、每小時待機比例）
  - `load`：`{ "base": 15, "gpuPeak": 85, "comm": 0.22, "Titer": 1.4, "duty": 0.64 }`（MW；base+gpuPeak 請 ≤ 105，圖表刻度以 100 MW 為準）
  - s2 才有 `area`：`{ "S": 40000, "H": 4.5, "R": 0.05 }`（區域系統 MW、慣量 s、下垂）

控制列的 `default` 會覆蓋 engineOpts 中同名的 key。

## controls 項目

```json
{ "type": "segmented", "key": "mode", "label": "可省略", "default": "fw", "small": false,
  "options": [ { "label": "無儲能", "value": "none" }, { "label": "飛輪", "value": "fw", "accent": "#FF9F43" } ] }
{ "type": "segmented", "key": "ramp", "label": "ramp 限值", "default": 2, "small": true, "alsoResetMode": true,
  "options": [ { "label": "1", "value": 1 }, { "label": "2 MW/s", "value": 2 } ] }
{ "type": "cycle", "key": "speed", "default": 2, "values": [1, 2, 5] }
{ "type": "button", "action": "trigger", "arg": "fault", "label": "⚡ 故障", "variant": "danger" }
{ "type": "button", "action": "pause" }
```

- `default` 必須是 options 裡的某個 value。
- `alsoResetMode: true`：改這個參數時順便清空累計 KPI（ramp 限值建議開）。
- `accent`：被選取時的底色。無儲能／無對策用預設白；GPU 用 `#B48CFF`；飛輪用 `#FF9F43`；協同用 `#FFC07A`。

## 文字模板（KPI、status 用）

`{欄位}`、`{欄位:小數位}` 之外，支援：

| 寫法 | 結果 |
|---|---|
| `{soe\|pct:1}` | ×100 後取 1 位小數 |
| `{rpm\|int}` | 千分位整數 |
| `{pf\|sign:1}` | 帶 ± 號 |
| `{job\|map:off=閒置;train=訓練中}` | 對照表 |
| `{ups\|bool:脫網;併網}` | 布林 |
| `{rec\|cap:98;> 8;2}` | 大於 98 顯示「> 8」，否則 2 位小數 |
| `{lossFTot\|div:1000;0}` | 除以 1000 後取 0 位小數 |
| `{fwCycles\|sci7}` | 寫成 1.8×10⁷ |

欄位不存在或為空時顯示「—」。欄位名稱見 `kpi-fields.md`。

## kpis 卡片

```json
{ "label": "電網側峰谷差（近 10 秒）", "value": "{ptpG:1}", "unit": "MW", "sub": "負載端 {ptpL:1} MW", "color": "#4DA3FF",
  "cases": [ { "if": [ { "f": "ptpG", "op": ">", "v": 10 } ], "color": "#FF8A8A" } ] }
{ "note": "一段固定說明文字（虛線框，填滿剩餘高度）" }
```

- `cases`：由上往下，第一個 `if` 全部成立的就套用它的欄位（可覆蓋 label、value、unit、sub、color）。
- `op`：`>` `<` `>=` `<=` `==` `!=` `null`（欄位為空）。
- 顏色慣例：電網 `#4DA3FF`、飛輪 `#FF9F43`、鋰電／UPS `#B48CFF`、合格 `#3DDC97`、不合格 `#FF8A8A`、中性 `#E6EAF0`。

## status、legend、side

```json
"status": { "label": "叢集狀態", "position": "left", "text": "{job|map:off=閒置;train=訓練中}", "color": "#3DDC97", "cases": [ ... ] }
"legend": [ { "color": "#4DA3FF", "label": "電網電流" }, { "label": "純文字提示" } ]
"side": { "type": "spec", "alt": "頻譜圖說明" }
"side": { "type": "text", "title": "事件時序", "lines": [ "第一行", "第二行" ] }
```
