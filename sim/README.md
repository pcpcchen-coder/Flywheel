# 3D 互動模擬（單一 HTML）

每個檔案都是獨立的單一 HTML（約 650 KB，已內嵌 three.js r149），下載後用 Chrome／Edge 直接開啟，可離線使用。

| 情境 | 檔案 |
|---|---|
| 索引頁 | [index.html](./index.html) |
| S1 同步擺盪平滑 | [S1-sync-swing.html](./S1-sync-swing.html) |
| S2 230 kV 故障穿越 | [S2-fault-ride-through.html](./S2-fault-ride-through.html) |
| S3 作業啟停與 ramp | [S3-job-ramp.html](./S3-job-ramp.html) |
| S4 20 年壽命對照 | [S4-lifecycle.html](./S4-lifecycle.html) |
| R1 AC 電流漣波 | [R1-current-ripple.html](./R1-current-ripple.html) |
| R2 ramp 與 LVRT | [R2-ramp-lvrt.html](./R2-ramp-lvrt.html) |

操作：拖曳旋轉、雙擊復位；上方按鈕切換模式與參數。即時 KPI 是滑動視窗，開頁後約 20–30 秒才穩定。

這些檔案由 [`skill/aidc-flywheel-3d`](../skill/aidc-flywheel-3d/) 產生（`prebuilt/` 的副本）。模型說明、基準數字與已知限制見 [docs/06-simulation.md](../docs/06-simulation.md)。

> 若在 repo 設定開啟 GitHub Pages（Settings → Pages → Branch `main`），可直接以 `https://<user>.github.io/flywheel/sim/` 線上瀏覽。
