const SAMPLE_TASKS = [
    { number: 0, startTime: 0, duration: 7 },
    { number: 1, startTime: 1, duration: 2 },
    { number: 2, startTime: 1, duration: 3 },
    { number: 3, startTime: 2, duration: 1 },
    { number: 4, startTime: 2, duration: 5 },
    { number: 5, startTime: 2, duration: 2 },
    { number: 6, startTime: 3, duration: 4 },
    { number: 7, startTime: 4, duration: 1 }
];

const taskInputEl = document.getElementById("taskInput");
const runBtnEl = document.getElementById("runBtn");
const clearBtnEl = document.getElementById("clearBtn");
const fillSampleBtnEl = document.getElementById("fillSampleBtn");
const statusEl = document.getElementById("status");

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
let playbackTimeIndex = -1;
let currentTime = 0;
let displayMessages = [];
let messageTimeMap = [];
let timePoints = [];
let pendingBackTime = { CPU0: 0, CPU1: 0 };
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

    if (msg.action === "create") {
        return ` 建立 ${msg.type} (ID: ${msg.instanceID})`;
    }

    if (msg.state) {
        return ` ${msg.instanceID} 狀態更新：${msg.state}`;
    }

    if (msg.action) {
        let objText = msg.object ? ` ➜ 目標: ${Array.isArray(msg.object) ? `[${msg.object.join(", ")}]` : msg.object}` : "";
        let valText = msg.val !== undefined ? ` (數值: ${Array.isArray(msg.val) ? `[${msg.val.join(", ")}]` : msg.val})` : "";
        return ` ${msg.instanceID} 執行 ${msg.action}${objText}${valText}`;
    }

    return JSON.stringify(msg);
}

function extractTimePoints(messages) {
    const times = new Set();
    const msgTimeMapAll = [];
    let currentCursorTime = 0;

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        let msgTime = currentCursorTime;

        // getInfo(startTime) advances the scheduler cursor
        if (msg.action === "getInfo" && msg.attribute === "startTime" && Number.isFinite(msg.content)) {
            currentCursorTime = msg.content;
            msgTime = currentCursorTime;
        }

        // compare(..., "current time") establishes the scheduler's current time.
        if (msg.action === "compare" && Array.isArray(msg.object)) {
            if (msg.object[1] === "current time" && Array.isArray(msg.val)) {
                currentCursorTime = msg.val[1];
                msgTime = currentCursorTime;
            }
        }

        // update(backX, endTime) extends timeline range
        if (
            msg.action === "update" &&
            (msg.object === "back0" || msg.object === "back1") &&
            Number.isFinite(msg.val)
        ) {
            times.add(msg.val);
        }

        msgTimeMapAll[i] = msgTime;
        times.add(msgTime);
    }

    // Build mapping for displayed messages (filter out getInfo)
    const msgTimeMapForDisplay = [];
    for (let i = 0, j = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.action === 'getInfo') continue;
        msgTimeMapForDisplay[j++] = msgTimeMapAll[i];
    }

    return [Array.from(times).sort((a, b) => a - b), msgTimeMapForDisplay];
}

function buildTasks(rawTasks) {
    if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
        throw new Error("請至少新增一個任務");
    }
    if (rawTasks.length > 1000) {
        throw new RangeError("任務數量太多了！");
    }

    const builtTasks = [];
    const createMessages = [];
    const seenNumbers = new Set();

    for (const item of rawTasks) {
        const { number, startTime, duration } = item || {};
        if (item.number === undefined || item.startTime === undefined || item.duration === undefined) {
            throw new TypeError("Task 必須具備 number/startTime/dutaion");
        }

        const values = [number, startTime, duration];
        if (!values.every(x => Number.isFinite(x) && Number.isInteger(x) && 0 <= x && x <= 1e10)) {
            throw new TypeError("number/startTime/duration 必須都是在 0 到 1e10 之間的整數");
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

    for (const entry of queueModel[name]) {
        const chip = document.createElement("div");
        chip.className = "queue-chip";
        chip.textContent = `T${entry.taskNo}`;
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

function resetAnimationViewState() {
    currentTime = 0;
    pendingBackTime = { CPU0: 0, CPU1: 0 };
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

function resetAnimationState() {
    clearPlaybackTimer();
    playbackTimeIndex = -1;
    resetAnimationViewState();
    if (timelineSliderEl) {
        timelineSliderEl.value = -1;
    }
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
        if (message.object === "back0") {
            cpu0EndDisplayEl.textContent = message.val;
            if (Number.isFinite(message.val)) pendingBackTime.CPU0 = message.val;
        }
        if (message.object === "back1") {
            cpu1EndDisplayEl.textContent = message.val;
            if (Number.isFinite(message.val)) pendingBackTime.CPU1 = message.val;
        }
    }
    if (message.action === "compare" && Array.isArray(message.object)) {
        if (message.object[1] === "current time" && Array.isArray(message.val)) {
            currentTime = message.val[1];
            sysTimeDisplayEl.textContent = message.val[1];
        }
    }

    if (message.instanceID === "CPU0" || message.instanceID === "CPU1") {
        const cpuName = message.instanceID;
        if (message.action === "push") {
            const taskNo = taskNumberFromText(message.val);
            if (Number.isFinite(taskNo)) {
                queueModel[cpuName].push({ taskNo, endTime: pendingBackTime[cpuName] });
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

function pruneCompletedTasksByTime(targetTime) {
    queueModel.CPU0 = queueModel.CPU0.filter((entry) => entry.endTime > targetTime);
    queueModel.CPU1 = queueModel.CPU1.filter((entry) => entry.endTime > targetTime);
    renderQueue("CPU0");
    renderQueue("CPU1");
}

function rebuildAnimationAtTime(targetTime) {
    resetAnimationViewState();
    currentTime = targetTime;

    if (targetTime < 0) {
        if (sysTimeDisplayEl) sysTimeDisplayEl.textContent = "-";
        return;
    }

    for (let i = 0; i < displayMessages.length; i++) {
        const msgTime = messageTimeMap[i];
        if (msgTime <= targetTime) {
            applyMessageToAnimation(displayMessages[i]);
        } else {
            break;
        }
    }

    pruneCompletedTasksByTime(targetTime);
    if (sysTimeDisplayEl) sysTimeDisplayEl.textContent = String(targetTime);
}

function stepForward() {
    if (!timePoints.length) {
        clearPlaybackTimer();
        return;
    }

    if (playbackTimeIndex >= timePoints.length - 1) {
        clearPlaybackTimer();
        return;
    }

    playbackTimeIndex += 1;
    const targetTime = timePoints[playbackTimeIndex];
    rebuildAnimationAtTime(targetTime);
    if (timelineSliderEl) timelineSliderEl.value = playbackTimeIndex;
}

function playAnimation() {
    if (!timePoints.length || playbackTimer) {
        return;
    }
    playbackTimer = setInterval(stepForward, 1000);
}

function errorHandling(errorMessage) {
    displayMessages = [];
    timePoints = [];
    messageTimeMap = [];
    resetAnimationState();
    if (timelineSliderEl) timelineSliderEl.disabled = true;
    setStatus(errorMessage || "執行失敗", "error");
}

function runAssignmentFromInput() {
    let parsed;
    try {
        setStatus("", "");
        parsed = JSON.parse(taskInputEl.value);
    } catch (err) {
        errorHandling("傳入資料不符合 JSON 格式");
        return;
    }
    try {
        const [tasks, createTaskMessages] = buildTasks(parsed);

        const [assignment, createCpuMessages] = AssignCPUTasks.create(tasks);
        const actionMessages = assignment.assignTasks();

        const allMessages = [...createTaskMessages, ...createCpuMessages, ...actionMessages];
        displayMessages = normalizeDisplayMessages(allMessages);

        // Extract time points and create message-to-time mapping using full message stream
        [timePoints, messageTimeMap] = extractTimePoints(allMessages);

        // Setup timeline slider based on time points (start at -1 for initial state)
        if (timelineSliderEl && timePoints.length > 0) {
            timelineSliderEl.disabled = false;
            timelineSliderEl.min = -1;
            timelineSliderEl.max = timePoints.length - 1;
            timelineSliderEl.value = -1;
        }

        resetAnimationState();
        playbackTimeIndex = -1;
        if (timelineSliderEl) timelineSliderEl.value = -1;
        setStatus("Assignment finished，按 Play 可看 Queue 動畫", "ok");
    } catch (err) {
        errorHandling(err.message);
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
    timePoints = [];
    messageTimeMap = [];
    playbackTimeIndex = -1;
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

//  新增拉桿的拖拉監聽器（實現瞬間跳轉）基於時間
if (timelineSliderEl) {
    timelineSliderEl.addEventListener("input", (e) => {
        clearPlaybackTimer();
        const targetTimeIndex = parseInt(e.target.value);
        if (!Number.isFinite(targetTimeIndex) || targetTimeIndex < -1 || targetTimeIndex >= timePoints.length) {
            return;
        }

        playbackTimeIndex = targetTimeIndex;
        const targetTime = targetTimeIndex === -1 ? -1 : timePoints[targetTimeIndex];
        rebuildAnimationAtTime(targetTime);
        timelineSliderEl.value = targetTimeIndex;
    });
}

loadSample();
runAssignmentFromInput();