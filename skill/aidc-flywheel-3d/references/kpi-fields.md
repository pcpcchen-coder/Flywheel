# KPI 欄位（每 0.25 秒由引擎提供）

功率單位 MW；SoE 為 0–1（顯示時用 `|pct`）；rpm 為轉速。

## s1（訓練同步擺盪平滑）
`mode` `pl` 負載 · `pg` 電網側 · `pf` 飛輪（+放電／−充電）· `soe` · `rpm`
`ptpL` `ptpG` 近 10 s 峰谷差 · `rmsL` `rmsG` 0.1 Hz 以上振盪 RMS · `att` 衰減 dB · `rampL` `rampG` 最大變化率 MW/s（100 ms）

## s2（230 kV 故障穿越）
`mode` `V` 併接點電壓 pu · `pl` `pg` `pf` · `q` 無功注入 MVAr · `ups` 是否已轉供 UPS（布林）
`df` 目前頻率偏差 Hz · `peakDf` 本次事件峰值偏差 · `peakLoss` 故障後持續失載（×N 座，MW）· `evE` 飛輪本次支撐能量 kWh · `soe` `rpm` · `crash` 訓練是否中斷 · `N` 座數

## s3（作業啟停與 ramp）
`mode` `ramp` 限值 · `pl` `pg` `pf` `soe` `rpm` · `rampG` 近 60 s 最大變化率 · `viol` 累計超限秒數
`wasteMWh` `wastePct` GPU 空轉耗電 · `throttleMWh` 限速損失 · `fwLossPct` 飛輪損耗占比 · `soeMin` `soeMax`（%）· `job`（off／train／ckpt）· `elapsed`

## s4（20 年壽命對照）
`year` 縮時年 · `soh` LFP 容量 % · `swaps` 已更換次數 · `swapsTotal` 20 年總更換 · `batLife` 單套壽命（年）
`efcYear` LFP 年等效全循環 · `fwCycles` 飛輪年微循環 · `disYear` 年放電 MWh
`lossB` `lossF` 至今累積損耗 MWh · `lossBTot` `lossFTot` 20 年累積損耗 MWh · `kdod` `efcRated` · `pf` `soe` `rpm`

## ripple（R1 電流漣波）與 ramp（R2 ramp／LVRT）
共通：`mode` `pl` `pg` `pf` `q` `V` `soe` `rpm` `job` `ups` `ramp` `bw`
漣波：`dIg` `dIl` 電流動態範圍 %（電網／負載）· `bandG` `bandL` 0.1–20 Hz 頻帶 RMS ／平均 % · `ihMax` 最大間諧波 dBc · `ihF` 其距 60 Hz 的偏移 Hz · `ihMaxL` 負載端最大間諧波
模態：`tor` `loc` 12 Hz 軸系／1 Hz 區域模態響應（無補償＝100%）· `torAbs` `locAbs` 絕對值
電流：`ifw` 飛輪電流 A（161 kV 側）· `igA` 電網電流 A
代價：`wastePct` GPU 額外耗電 % · `thrPct` 算力限速 %
ramp／LVRT：`rampMax` 1 s 平均最大 ramp（排除故障恢復窗）· `viol` 累計超限 s · `rec` 故障後恢復 90% 秒數（未發生為空；99＝8 s 內未恢復）· `imax` 故障期間最大電流 pu
