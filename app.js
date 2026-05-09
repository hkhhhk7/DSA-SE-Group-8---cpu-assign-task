const SAMPLE_TASKS = [
    { number: 0, startTime: 0, duration: 1 },
    { number: 1, startTime: 1, duration: 2 },
    { number: 2, startTime: 1, duration: 3 },
    { number: 3, startTime: 2, duration: 1 }
];

const taskInputEl = document.getElementById("taskInput");
const runBtnEl = document.getElementById("runBtn");
const clearBtnEl = document.getElementById("clearBtn");
const fillSampleBtnEl = document.getElementById("fillSampleBtn");
const outputListEl = document.getElementById("outputList");
const statusEl = document.getElementById("status");
const messageCountEl = document.getElementById("messageCount");

const playBtnEl = document.getElementById("playBtn");
const pauseBtnEl = document.getElementById("pauseBtn");
const stepBtnEl = document.getElementById("stepBtn");
const resetAnimBtnEl = document.getElementById("resetAnimBtn");
const taskPoolEl = document.getElementById("taskPool");
const cpu0LaneEl = document.getElementById("cpu0Lane");
const cpu1LaneEl = document.getElementById("cpu1Lane");
const cpu0StateEl = document.getElementById("cpu0State");
const cpu1StateEl = document.getElementById("cpu1State");
const currentMessageEl = document.getElementById("currentMessage");
const sysTimeDisplayEl = document.getElementById("sysTimeDisplay");
const cpu0EndDisplayEl = document.getElementById("cpu0EndDisplay");
const cpu1EndDisplayEl = document.getElementById("cpu1EndDisplay");

//  取得拉桿元素
const timelineSliderEl = document.getElementById("timelineSlider");

let playbackTimer = null;
let playbackIndex = -1;
let displayMessages = [];
let queueModel = { CPU0: [], CPU1: [] };

function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.classList.remove("ok", "error");
    if (type) {
        statusEl.classList.add(type);
    }
}

function taskNumberFromText(raw) {
    if (typeof raw !== "string") {
        return null;
    }
    const matched = raw.match(/task\s+(-?\d+)/i);
    return matched ? Number(matched[1]) : null;
}

function normalizeDisplayMessages(messages) {
    return messages.filter((message) => message.action !== "getInfo");
}
function formatMessageForDisplay(msg) {
    if (!msg) return "-";
    
    // 1. 處理 Create 訊息
    if (msg.action === "create") {
        return ` 建立 ${msg.type} (ID: ${msg.instanceID})`;
    }
    
    // 2. 處理 State 狀態訊息
    if (msg.state) {
        return ` ${msg.instanceID} 狀態更新：${msg.state}`;
    }
    
    // 3. 處理一般 Action 動作訊息
    if (msg.action) {
        let objText = msg.object ? ` ➜ 目標: ${Array.isArray(msg.object) ? `[${msg.object.join(", ")}]` : msg.object}` : "";
        let valText = msg.val !== undefined ? ` (數值: ${Array.isArray(msg.val) ? `[${msg.val.join(", ")}]` : msg.val})` : "";
        return ` ${msg.instanceID} 執行 ${msg.action}${objText}${valText}`;
    }
    
    // 如果都不符合，才退回顯示 JSON
    return JSON.stringify(msg);
}

function renderOutput(messages) {
    outputListEl.innerHTML = "";
    for (let i = 0; i < messages.length; i += 1) {
        const li = document.createElement("li");
        li.textContent = JSON.stringify(messages[i]);
        li.style.animationDelay = `${Math.min(i * 14, 300)}ms`;
        outputListEl.appendChild(li);
    }
    messageCountEl.textContent = `${messages.length} messages`;
}

function buildTasks(rawTasks) {
    if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
        throw new Error("請至少新增一個任務");
    }

    const builtTasks = [];
    const createMessages = [];
    const seenNumbers = new Set();

    for (const item of rawTasks) {
        const { number, startTime, duration } = item || {};
        const values = [number, startTime, duration];
        if (!values.every(Number.isFinite)) {
            throw new TypeError("number/startTime/duration 必須都是數字");
        }
        if (startTime < 0) {
            throw new Error("startTime 必須 >= 0");
        }
        if (duration <= 0) {
            throw new Error("duration 必須 > 0");
        }
        if (seenNumbers.has(number)) {
            throw new Error("number 不可重複");
        }
        seenNumbers.add(number);

        const [task, messages] = Task.create(number, startTime, duration);
        builtTasks.push(task);
        createMessages.push(...messages);
    }

    return [builtTasks, createMessages];
}

function renderTaskPoolFromInput() {
    taskPoolEl.innerHTML = "";
    let parsed = [];
    try {
        parsed = JSON.parse(taskInputEl.value);
    } catch (_) {
        return;
    }

    if (!Array.isArray(parsed)) {
        return;
    }

    for (const item of parsed) {
        if (!item || !Number.isFinite(item.number)) {
            continue;
        }
        const chip = document.createElement("div");
        chip.className = "task-chip";
        chip.id = `task-chip-${item.number}`;
        chip.textContent = `T${item.number}`;
        taskPoolEl.appendChild(chip);
    }
}

function renderQueue(name) {
    const laneEl = name === "CPU0" ? cpu0LaneEl : cpu1LaneEl;
    laneEl.innerHTML = "";

    for (const taskNo of queueModel[name]) {
        const chip = document.createElement("div");
        chip.className = "queue-chip";
        chip.textContent = `T${taskNo}`;
        laneEl.appendChild(chip);
    }
}

function markTaskAssigned(taskNo) {
    const el = document.getElementById(`task-chip-${taskNo}`);
    if (!el) {
        return;
    }
    el.classList.add("assigned");
}

function clearPlaybackTimer() {
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
}

function resetAnimationState() {
    clearPlaybackTimer();
    playbackIndex = -1;
    queueModel = { CPU0: [], CPU1: [] };
    cpu0StateEl.textContent = "idle";
    cpu1StateEl.textContent = "idle";
    currentMessageEl.textContent = "Current: -";
    if (sysTimeDisplayEl) sysTimeDisplayEl.textContent = "-";
    if (cpu0EndDisplayEl) cpu0EndDisplayEl.textContent = "0";
    if (cpu1EndDisplayEl) cpu1EndDisplayEl.textContent = "0";
    renderTaskPoolFromInput();
    renderQueue("CPU0");
    renderQueue("CPU1");
}

function applyMessageToAnimation(message) {
    currentMessageEl.textContent = formatMessageForDisplay(message);

    if (message.state && (message.instanceID === "CPU0" || message.instanceID === "CPU1")) {
        const stateEl = message.instanceID === "CPU0" ? cpu0StateEl : cpu1StateEl;
        stateEl.textContent = message.state;

        // 觸發 CSS 動畫
        stateEl.classList.remove("updating");
        void stateEl.offsetWidth; 
        stateEl.classList.add("updating");
        return;
    }

    if (!message.action) {
        return;
    }
    if (message.action === "update") {
        if (message.object === "back0") cpu0EndDisplayEl.textContent = message.val;
        if (message.object === "back1") cpu1EndDisplayEl.textContent = message.val;
    }
    if (message.action === "compare" && Array.isArray(message.object)) {
        if (message.object[1] === "current time" && Array.isArray(message.val)) {
            sysTimeDisplayEl.textContent = message.val[1];
        }
    }

    if (message.instanceID === "CPU0" || message.instanceID === "CPU1") {
        const cpuName = message.instanceID;
        if (message.action === "push") {
            const taskNo = taskNumberFromText(message.val);
            if (Number.isFinite(taskNo)) {
                queueModel[cpuName].push(taskNo);
                markTaskAssigned(taskNo);
                renderQueue(cpuName);
            }
            return;
        }

        if (message.action === "pop") {
            queueModel[cpuName].shift();
            renderQueue(cpuName);
            return;
        }

        if (message.action === "move") {
            renderQueue(cpuName);
            return;
        }
    }
}

function stepForward() {
    if (playbackIndex >= displayMessages.length - 1) {
        clearPlaybackTimer();
        return;
    }

    playbackIndex += 1;
    //  讓拉桿隨動畫前進
    if (timelineSliderEl) timelineSliderEl.value = playbackIndex; 
    applyMessageToAnimation(displayMessages[playbackIndex]);
}

function playAnimation() {
    if (!displayMessages.length || playbackTimer) {
        return;
    }
    playbackTimer = setInterval(stepForward, 1000);
}

function runAssignmentFromInput() {
    try {
        setStatus("", "");

        const parsed = JSON.parse(taskInputEl.value);
        const [tasks, createTaskMessages] = buildTasks(parsed);

        const [assignment, createCpuMessages] = AssignCPUTasks.create(tasks);
        const actionMessages = assignment.assignTasks();

        const allMessages = [...createTaskMessages, ...createCpuMessages, ...actionMessages];
        displayMessages = normalizeDisplayMessages(allMessages);
        renderOutput(displayMessages);
        
        //  關鍵：解鎖拉桿並設定最大值
        if (timelineSliderEl && displayMessages.length > 0) {
            timelineSliderEl.disabled = false;
            timelineSliderEl.max = displayMessages.length - 1;
            timelineSliderEl.value = 0;
        }

        resetAnimationState();
        setStatus("Assignment finished，按 Play 可看 Queue 動畫", "ok");
    } catch (err) {
        displayMessages = [];
        renderOutput([]);
        resetAnimationState();
        if (timelineSliderEl) timelineSliderEl.disabled = true; // 失敗時鎖住拉桿
        setStatus(err.message || "執行失敗", "error");
    }
}

function loadSample() {
    taskInputEl.value = JSON.stringify(SAMPLE_TASKS, null, 2);
    renderTaskPoolFromInput();
    setStatus("Sample loaded.", "ok");
}

runBtnEl.addEventListener("click", runAssignmentFromInput);
clearBtnEl.addEventListener("click", () => {
    displayMessages = [];
    renderOutput([]);
    resetAnimationState();
    if (timelineSliderEl) timelineSliderEl.disabled = true;
    setStatus("Output cleared.", "");
});
fillSampleBtnEl.addEventListener("click", loadSample);

playBtnEl.addEventListener("click", playAnimation);
pauseBtnEl.addEventListener("click", clearPlaybackTimer);
stepBtnEl.addEventListener("click", () => {
    clearPlaybackTimer();
    stepForward();
});
resetAnimBtnEl.addEventListener("click", resetAnimationState);

//  新增拉桿的拖拉監聽器（實現瞬間跳轉）
if (timelineSliderEl) {
    timelineSliderEl.addEventListener("input", (e) => {
        clearPlaybackTimer(); 
        const targetIndex = parseInt(e.target.value);
        
        resetAnimationState();
        for (let i = 0; i <= targetIndex; i++) {
            playbackIndex = i;
            applyMessageToAnimation(displayMessages[i]);
        }
        timelineSliderEl.value = targetIndex; 
    });
}

loadSample();
runAssignmentFromInput();