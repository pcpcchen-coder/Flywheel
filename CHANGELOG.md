# 版本紀錄

## 2026-11-25

- 新增 `CLAUDE.md`：claude.ai 對話交接（脈絡、偏好、指令、待辦、已定案觀點），供 Claude Code 接續。
- 新增簡報原始碼 `slides/source/v1`、`v2` 與匯出流程 `slides/tools/`（render → extract → python-pptx → PDF → 逐頁 PNG／講稿）；已驗證重建 v2 PPTX 與現有版本一致。
- 待辦新增：v2 第 10 頁 BESS 時間尺度下緣、第 11 頁飛輪「容量不衰減」措辭（待確認後修正）。

## 2026-11-23

- 新增 `research/flywheel-raiba-2026/`：24 頁飛輪儲能 × RAIBA 技術研發立項完整報告（DOCX）、24 頁可編輯簡報（PPTD）、全頁與逐頁預覽、生成器、技術圖、19 項來源登錄與驗證紀錄。
- 立項內容收斂為重構暫態穩定、故障功率橋接、服務不間斷 EIS 與診斷驅動重構；建立 A／B／B2／C 架構、12 項研發議題、KPI／Kill criteria、B0–B3 對照及 12 個月 MVP，並納入 FESS＋DRBN、RBS-EIS 與共 DC-bus 直接前案，避免首創過度宣稱。
- 根目錄與研究索引補上立項報告、簡報、預覽及證據邊界入口；保留原有 AIDC 與全球飛輪研究，不覆蓋既有文件。
- 新增 `research/flywheel-landscape-2026/`：26 頁飛輪儲能技術全景報告（DOCX）、32 頁技術簡報（PPTD）、全頁預覽、生成器、圖表、研究 CSV 與驗證紀錄。
- 研究範圍包括學術文獻、代表專利、全球與中國廠商、產品與專案、鋰電／氫能整合、標準與採購驗收、2027–2031 三情境；README 補上入口與證據口徑。
- 建立 repo，彙整所有產出：v1／v2 簡報（PPTX、PDF、講稿）、6 個 3D 情境、aidc-flywheel-3d skill、技術文件、名詞詳解、營運風險資料。
- 新增文件：飛輪 SOH 估計（07）、營運風險比較（08）。
- 名詞詳解自 Claude Docs 匯出快照（158 條）。

## 2026-11-12

- aidc-flywheel-3d skill：給 qwen3.8-27b-fp8 使用，設定驅動的頁面模板、驗證器、check_engine、smoke_test；依測試回饋修正文件、build_all 略過非設定檔、Pmax 縮放、頻譜標籤重疊。

## 2026-11-02

- v2：聚焦 AC 電流漣波與 ramp／LVRT（參考 arXiv 2508.14318、ERCOT NOGRR282）；簡報 18 頁；3D 情境 R1、R2。
- v1：飛輪儲能控制邏輯與導入效益；簡報 16 頁；3D 情境 S1–S4。

## 待辦

- [ ] S3 改用 1 s 平均 ramp 指標（與 R2 一致），並更新 v1 簡報第 2、13 頁數字：S1 峰谷差 0.7 → 約 2.3 MW、變化率 1.8 → 約 14 MW/s、S3 飛輪超限 0 → 依新指標重算。
- [ ] 向台電確認大型 AI 負載的 ramp、動態範圍與穿越要求。
- [ ] 以真實 AIDC 負載波形校正示意模型。
