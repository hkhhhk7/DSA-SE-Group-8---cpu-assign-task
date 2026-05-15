# DSA SE Group8 - CPU Scheduling Visualizer

> 透過互動式介面與動態演算法，將DSA HW2 handwriting part曾經出現的cpu assinment問題進行實作，以queue的實作來表現cpu排程不同task的實際使用情形


## 介面操作方法 (How to Use)

本視覺化系統主要分為「輸入區」、「控制區」與「展示區」三大區塊，提供完整的排程模擬與觀察體驗。

### 1. 任務資料輸入 (Task Input Setup)
使用者需以 JSON 陣列格式輸入欲模擬的 Process 任務。
* **載入範例 (Load Sample)：** 若不想手動輸入，可點擊 `Load Sample` 按鈕，系統會自動填入一組包含 8 個任務的預設測資。
* **自訂輸入限制：**
    * `number` (任務 ID)：必須為 0 ~ 1e10 之間的唯一整數。
    * `startTime` (到達時間)：必須 $\ge 0$ 且 $\le 1e10$。
    * `duration` (執行時間)：必須 > 0 且 $\le 1e10$。
* **啟動運算：** 點擊 `Run Assignment` 後，後端演算法會瞬間完成排程計算，並將結果交由前端準備播放。

### 2. 動畫播放控制 (Playback Controls)
系統提供細緻的播放控制，方便使用者觀察演算法在特定時間點的決策：
* **Play / Pause (播放與暫停)：** 自動播放 Queue 的推入與彈出動畫。
* **Step (單步執行)：** 手動點擊進行「下一步」，仔細檢視 CPU 狀態與時間推進的關聯。
* **Timeline Slider (時間進度拉桿) ：** 使用者可自由拖曳進度條，畫面與內部狀態會瞬間跳轉至該指定階段，方便反覆比對排程邏輯。
* **Reset (重置)：** 將動畫與狀態列退回初始狀態。

### 3. 即時數據與畫面觀察重點
* **任務池 (Task Pool)：** 當任務被成功指派進入 CPU 佇列時，標籤會反灰 (`assigned` 狀態)。
* **全局時間看板：** 即時顯示「當下處理時間」以及「CPU0 / CPU1 的預計完工時間」。
* **佇列狀態監視：** 每個 CPU 旁邊配有即時狀態標籤（如 `is empty`, `need compare`）。狀態變化時會觸發黃色閃爍動畫，提示演算法正在該 CPU 上進行邏輯判斷。

## 演算法邏輯與資料結構 (Algorithm Logic)

本系統的核心排程器 (`AssignCPUTasks`) 負責模擬作業系統將 Process 分發給多核心 CPU 的決策過程。為了達到完美的視覺化與邏輯解耦，我們採用了以下機制：

### 1. 核心資料結構
* **`Queue` 類別：** 模擬 CPU 的就緒佇列。使用動態陣列實作，提供 `push` (推入尾端)、`pop` (移除前端)、`peek` (偷看前端任務的預計完成時間) 等標準佇列操作。

* **`Task` 類別：** 封裝單一任務的屬性（編號 `number`、到達時間 `startTime`、執行時間 `duration`）。

### 2. 排程與負載平衡工作流 (Workflow)
系統在接收任務清單後，會執行以下步驟，並將思考過程記錄成事件日誌：

* **Step 1: 預處理排序 (Initial Sort)**
  將所有輸入的任務依照其**到達時間 (Start Time)** 進行升序排序，確保任務依照時間軸順序進入系統。
  
* **Step 2: 時間推進與過期任務清理 (Time Progression & Pop)**
  準備處理新任務時，獲取該任務的到達時間 (`curTime`)，並檢查 `CPU0` 與 `CPU1` 目前排在最前面的任務 (`peek()`)。
  若佇列中最前端任務的預計完成時間 **小於或等於** 當下時間，代表該任務已執行完畢，系統會將其彈出 (`pop()`)，釋放佇列空間。

* **Step 3: 雙核心負載平衡決策 (Load Balancing Decision)**
  如同hw2問題內所設計的情形，清理完過期任務後，系統會即時獲取並比較 `CPU0` 與 `CPU1` 當下的佇列長度 (`size`)：
  ```javascript
  if (size1 < size0) {
      targetCPU = CPU1; // 若 CPU1 比較閒，交給 CPU1
  } else {
      targetCPU = CPU0; // 若 CPU0 比較閒，或兩者一樣長，預設交給 CPU0
  }
  ```
  透過永遠將任務丟給**當下長度較短的佇列**，確保了兩顆 CPU 的工作負載能達到動態平衡。

* **Step 4: 狀態更新與預測 (State Update)**
  決定目標 CPU 後，將任務推入該 CPU 的佇列尾端，並依據該 CPU 目前最後一個任務的完工時間，計算出新任務的預計完工時間 (`endTime`)，以供下一輪迴圈判斷使用。

## 📂 專案架構 (Project Structure)

```text
├── index.html          # 系統主入口與 UI 介面
├── styles.css          # 介面樣式表
├── app.js              # 前端邏輯、DOM 操作與時間軸播放器
└── assignCPUTasks.js   # 後端：Queue 資料結構與排程邏輯
```
