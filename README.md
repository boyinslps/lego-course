# 樂高競賽課程（lego-course）

SPIKE Prime 校隊的新課程系列：用 LEGO 官方 SPIKE App 當主體，這裡的頁面只補中文導讀、練習與闖關。

- `index.html`：課程目錄；每一節一個 `L##/index.html`。
- `L02/`：第 2 節 認識主機與六個零件（接口、開機、連線，再依序認識燈陣、馬達、顏色、距離、力、陀螺儀）。每個零件三頁：說明 → 官方教學 → 小測驗。
- `assets/course.js`、`assets/course.css`：共用引擎（步驟分頁、闖關、星星、身分列、筆記本儲存、老師模式、列印）。
- `assets/firebase-config.js`：預設 `null`，只存瀏覽器；要存雲端時照檔內說明設定。
- `官方資料備份/`：官方六個入門教學的原文與中文、程式卡圖（本機參考，不放進學生頁）。
- `L02_規劃.md`：第 2 節的規劃與設計決定。
- 身分 ＝ 隊伍（隊伍一／二）＋班級＋座號；沒有姓名。
- 老師模式：網址加 `#teacher`（或按「老師模式」，密碼 `teacher`，改 `window.LC_TEACHER_PW`）。
- 本機預覽：`python -m http.server 8793 -d lego-course`，開 <http://localhost:8793/>。

made by 資訊老師黃博胤
