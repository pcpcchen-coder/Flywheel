# 參考資料

## 主要文獻

- Choukse et al.（Microsoft、OpenAI、NVIDIA），*Power Stabilization for AI Training Datacenters*，[arXiv 2508.14318](https://arxiv.org/abs/2508.14318)：GPU 負載行為、頻譜、規範框架（ramp、動態範圍、0.1–20 Hz）、GPU 層平滑與共享 SoC 建議。本專案的主要依據。
- *EasyRider*（機櫃電池＋LC 濾波），[arXiv 2604.15522](https://arxiv.org/abs/2604.15522)：軟體 burn 額外耗能約 19%、作業級階躍。
- *Best Practices for Large Load Interconnections*，[arXiv 2601.12686](https://arxiv.org/abs/2601.12686)：各電力公司 ramp／PQ 要求整理（Southern、AEP、Dominion、ERCOT）。
- [arXiv 2609.27698](https://arxiv.org/abs/2609.27698)：解法盤點引用（見 v2 簡報第 9 頁）。

## 規範與機構

- ERCOT [NOGRR282](https://www.ercot.com/mktrules/issues/NOGRR282)：大型電子／計算型負載電壓與頻率穿越要求（2026/6 董事會通過、待 PUCT 核定）。
- NERC Level 3 Essential Action Alert（計算型負載），2026/5/4 發布；Renewable Energy World 2026/5 報導。
- NERC 2024/7/10 北維吉尼亞事件回顧；Data Center Dynamics 2025/3 報導。
- 台電大型 AI 負載併網要求：**待確認**。

## 產業資料

- NVIDIA 技術部落格：GB300 NVL72 功率平滑（機櫃電容 65 J/GPU、NVIDIA SMI／Redfish 設定）、800 VDC 架構。
- Siemens Energy，*Impact of AI workload and E-STATCOM*（ERCOT 2025/8）：模態放大、弱電網傳遞、E-STATCOM ±75 MW 規格。
- *Energies* 13, 4441：飛輪待機損耗分析（約 1%/h）。
- 長治 30 MW 磁浮飛輪調頻電站（BC New Energy，2024 併網）：規模化可行性參考，非 AIDC 應用。

## 營運風險與事故

- Beacon Power Stephentown 2011 轉子失效：[Eastwick Press](https://eastwickpress.com/news/2011/07/a-mishap-at-the-beacon-power-frequency-flywheel-plant)、[Fortnightly — What Happened at Beacon](https://www.fortnightly.com/fortnightly/2012/05/what-happened-beacon)
- SK C&C 板橋資料中心 2022 鋰電池火災：[Data Center Knowledge](https://www.datacenterknowledge.com/business/data-center-fire-triggers-lithium-ion-battery-doubts-for-south-korea)
- NIRS 大田機房 2025 鋰電池火災：[Korea Times](https://www.koreatimes.co.kr/business/companies/20250928/govt-lg-face-scrutiny-after-state-data-center-fire)、[Uptime Institute](https://intelligence.uptimeinstitute.com/resource/south-korean-data-center-fire-sparks-stark-reminder)

## 說明

- 簡報與模擬中的數字，凡標「示意」者，來自本專案自建的示意模型（100 MW AIDC、飛輪 80 MW／0.8 MWh），不是量測或廠商數據。
- 候選飛輪廠商（Beacon、Torus、Piller、VYCON、BC New Energy）僅為公開資訊整理，尚未接洽。
