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

function taskNumberFromText(raw) { //字串轉數字
    if (typeof raw !== "string") {
        return null;
    }
    const matched = raw.match(/task\s+(-?\d+)/i);
    return matched ? Number(matched[1]) : null;
}

function normalizeDisplayMessages(messages) {
    return messages.filter((message) => message.action !== "getInfo");
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
    renderTaskPoolFromInput();
    renderQueue("CPU0");
    renderQueue("CPU1");
}

function applyMessageToAnimation(message) {
    currentMessageEl.textContent = `Current: ${JSON.stringify(message)}`;

    if (message.state && (message.instanceID === "CPU0" || message.instanceID === "CPU1")) {
        const stateEl = message.instanceID === "CPU0" ? cpu0StateEl : cpu1StateEl;
        stateEl.textContent = message.state;
        return;
    }

    if (!message.action) {
        return;
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
    applyMessageToAnimation(displayMessages[playbackIndex]);
}

function playAnimation() {
    if (!displayMessages.length || playbackTimer) {
        return;
    }
    playbackTimer = setInterval(stepForward, 460);
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
        resetAnimationState();
        setStatus("Assignment finished，按 Play 可看 Queue 動畫", "ok");
    } catch (err) {
        displayMessages = [];
        renderOutput([]);
        resetAnimationState();
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

loadSample();
runAssignmentFromInput();
