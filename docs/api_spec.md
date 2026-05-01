# DSA SE 8group


## Input(前端呼叫後端)

* **傳入參數：** `tasks` (Array of Objects)

| Key | Type | 說明 | Restriction |
| :--- | :--- | :--- | :--- |
| `number` | Number | 任務的唯一編號 | 不可重複 |
| `startTime` | Number | 任務抵達系統的時間 | $\ge 0$ |
| `duration` | Number | 任務執行所需時間 | $> 0$ |
** BE 追記：請調用 create 方法，不要用內建的 constructor，不然會漏一些初始化 / 訊息 **

**前端傳入範例：**
```json
[
  { "number": 0, "startTime": 0, "duration": 1 },
  { "number": 1, "startTime": 1, "duration": 2 }
]
```

## 後端輸出

回傳Array，每一個元素都是一個Object，代表演算法在特定瞬間執行的一個微小動作。


---

### 輸出格式

後端輸出的物件遵守以下四種格式。FE請優先透過判斷 `action` 與 `state` 欄位來決定如何繪製：

#### 1. 建立 (Create Message)
在畫布上初始化新的物件或變數。
* **觸發條件：** `action === "create"`

| Key | Type | 說明 (Description) | 範例值 |
| :--- | :--- | :--- | :--- |
| `type` | String | 要建立的實體種類 | `"Task"`, `"Queue"`, `"Number"` |
| `instanceID` | String/Number | 該實體專屬 ID /名稱 | `0` (Task 0), `"CPU0"` |

#### 2. 動作指令 (Action Message) 
用於通知前端執行物件的移動、Queue的推入/彈出、或是邏輯數值的比較。
* **條件：** 擁有 `action` 欄位，且其值不為 `"create"` 或 `"getInfo"`

| Key | Type | 說明 (Description) | 範例值 |
| :--- | :--- | :--- | :--- |
| `instanceID` | String | 執行該動作的對象 | `"CPU0"`, `"assignment"` |
| `action` | String | 具體的動作指令 | `"push"`, `"pop"`, `"move"`, `"assign"`, `"compare"`, `"update"`, `"increase"`, `"decrease"` |
| `object` | String/Array | 動作的受詞或目標屬性 | `"task 0"`, `["size", "zero"]` |
| `val` | Number/Array/String| 動作伴隨的數值或結果 | `1`, `[0, 0]`, `"task 0"` |

#### 3. 狀態更新指令 (State Message)
記錄判斷結果 **看有沒有需要做一個判斷狀況的動畫**
* **觸發條件：** 物件內擁有 `state` 欄位

| Key | Type | 說明 (Description) | 範例值 |
| :--- | :--- | :--- | :--- |
| `instanceID` | String | 狀態改變的對象 | `"CPU0"`, `"CPU1"` |
| `state` | String | 當下的狀態描述字串 | `"is empty"`, `"need compare"`, `"finish compare"` |

####  4. 內部讀取紀錄 (Get Info Message) ⚠️ 略過
這是後端演算法讀取內部變數的痕跡，**畫面上不需要有任何對應的動畫**。
* **觸發條件：** `action === "getInfo"`
* **前端處理方式：** 讀取到此物件時，請直接忽略並讀取陣列的下一個元素。

---

### 📝 後端完整輸出範例 (JSON Array)

可以先用這筆假資料實作：
```json
[
  { "action": "create", "type": "Task", "instanceID": 0 },
  { "action": "create", "type": "Queue", "instanceID": "CPU0" },
  { "action": "create", "type": "Queue", "instanceID": "CPU1" },
  { "action": "getInfo", "instanceID": 0, "attribute": "startTime", "content": 0 },
  { "action": "getInfo", "instanceID": "CPU0", "attribute": "size", "content": 0 },
  { "instanceID": "CPU0", "action": "compare", "object": ["size", "zero"], "val": [0, 0] },
  { "instanceID": "CPU0", "state": "is empty" },
  { "instanceID": "assignment", "action": "compare", "object": ["size of CPU0", "size of CPU1"], "val": [0, 0] },
  { "instanceID": "assignment", "action": "assign", "object": "CPU0", "val": "task 0" },
  { "instanceID": "CPU0", "action": "increase", "object": "size", "val": 1 },
  { "instanceID": "CPU0", "action": "push", "object": "CPU0", "val": 0 }
]
```

##  三、 防呆機制
確保系統不崩潰，最後處理

| 狀況 | BE 行為 |FE 行為 |
| :--- | :--- | :--- |
| 任務陣列為空 | 拋出 `Error('tasks is empty')` | 在 UI 點擊開始前就先阻擋，跳出提示：「請至少新增一個任務」 |
| 數字格式錯誤 | 拋出 `TypeError` | 驗證輸入框，確保使用者不能輸入文字或負數的 duration |