function generateTypeError(variantName, targetType, functionName) {
    return `${variantName} is not instance of "${targetType}" in ${functionName}`
}

function generateCreateMessage(type, instanceID) {
    return {
        action: 'create',
        type: type,
        instanceID: instanceID
    };
}

function generateGetInfoMessage(instanceID, attribute, content) {
    return {
        action: 'getInfo',
        instanceID: instanceID,
        attribute: attribute,
        content: content,
    };
}

function generateActionMessage(instanceID, action, object, val) {
    return {
        instanceID: instanceID,
        action: action,
        object: object,
        val: val
    };
}

function generateStateMessage(instanceID, state) {
    return {
        instanceID: instanceID,
        state: state
    };
}

class Task {
    #number;
    #startTime;
    #duration;

    constructor(number, startTime, duration) {
        // type check
        if (!Number.isFinite(number)) {
            throw new TypeError(generateTypeError('number', 'Number', 'Task.constructor'));
        }
        if (!Number.isFinite(startTime)) {
            throw new TypeError(generateTypeError('startTime', 'Number', 'Task.constructor'));
        }
        if (!Number.isFinite(duration)) {
            throw new TypeError(generateTypeError('duration', 'Number', 'Task.constructor'));
        }
        this.#number = number;
        this.#startTime = startTime;
        this.#duration = duration;
    }

    static create(number, startTime, duration) {
        let createdTask = new Task(number, startTime, duration);
        return [createdTask, [generateCreateMessage('Task', createdTask.getNumber())]];
    }

    // return with value and message
    getStartTime() {
        return [this.#startTime, [generateGetInfoMessage(this.getNumber(), 'startTime', this.#startTime)]];
    }

    // return with only value
    getStartTimeValue() {
        return this.#startTime;
    }

    // return with value and message
    getDuration() {
        return [this.#duration, [generateGetInfoMessage(this.getNumber(), 'duration', this.#duration)]];
    }

    // return with only message
    getDurationValue() {
        return this.#duration;
    }

    // get id number of this task
    getNumber() {
        return this.#number;
    }
}

class Queue {
    #size;
    #data;
    #name;

    constructor(name) {
        this.#size = 0;
        this.#data = [];
        this.#name = name;
    }

    getName() {
        return this.#name;
    }

    static create(name) {
        let createdQueue = new Queue(name);
        return [createdQueue, [generateCreateMessage('Queue', createdQueue.getName())]];
    }

    push(data) {
        let result = [];
        this.#size += 1; result.push(generateActionMessage(this.getName(), 'increase', 'size', 1));
        this.#data.push(data); result.push(generateActionMessage(this.getName(), 'push', this.getName(), `task ${data.taskNumber}`));
        return result;
    }

    pop() {
        if (this.#size <= 0) {
            return [];
        }

        let result = [];
        let removedTask = this.#data.shift();
        result.push(generateActionMessage(this.getName(), 'pop', this.getName(), `task ${removedTask.taskNumber}`));
        this.#size -= 1; result.push(generateActionMessage(this.getName(), 'decrease', 'size', 1));

        // move the data for animation
        for (let i = 0; i < this.#size; i++) {
            result.push(generateActionMessage(this.getName(), 'move', `task ${this.#data[i].taskNumber}`, i));
        }

        return result;
    }

    peek() {
        if (this.#size <= 0) {
            return [Infinity, [generateActionMessage(this.getName(), 'peek', this.getName(), Infinity)]];
        }

        let front = this.#data[0];
        return [front.endTime, [generateActionMessage(this.getName(), 'peek', this.getName(), front.endTime)]];
    }

    getSize() {
        return [this.#size, [generateGetInfoMessage(this.getName(), 'size', this.#size)]];
    }
}

class AssignCPUTasks {
    #CPU0;
    #CPU1;
    #tasks;

    constructor(tasks) {
        // check type
        if (!Array.isArray(tasks)) {
            throw new TypeError(generateTypeError('tasks', 'Array', 'AssignCPUTasks.constructor'));
        }

        if (tasks.length === 0) {
            throw new Error('tasks is empty');
        }

        if (!tasks.every(item => item instanceof Task)) {
            throw new TypeError(generateTypeError('tasks', 'Array[Task]', 'AssignCPUTasks.constructor'));
        }

        this.#tasks = tasks.sort(
            (a, b) => (a.getStartTimeValue() - b.getStartTimeValue())
        );
    }

    static create(tasks) {
        let createdAssignCPUTasks = new AssignCPUTasks(tasks);
        let createMessage0, createMessage1;
        [createdAssignCPUTasks.#CPU0, createMessage0] = Queue.create("CPU0");
        [createdAssignCPUTasks.#CPU1, createMessage1] = Queue.create("CPU1");

        return [createdAssignCPUTasks, [...createMessage0, ...createMessage1]];
    }

    // return status that greater equal than startTime
    assignTasks(startTime = 0) {
        console.log(`startTime: ${startTime}`);
        // type check
        if (!Number.isFinite(startTime)) {
            throw new TypeError(generateTypeError('startTime', 'Number', 'AssignCPUTasks.assignTasks'));
        }


        let result = [];
        let backs = [0, 0];

        if (startTime === 0) {
            result.push(generateCreateMessage('Number', 'back0'));
            result.push(generateCreateMessage('Number', 'back1'));
        }

        let recordMessage = false;
        for (const task of this.#tasks) {
            // fist step: pop out executed processes
            let [curTime, message0] = task.getStartTime();
            let [duration, message1] = task.getDuration();

            if (startTime === 0) {
                result.push(...message0);
                result.push(...message1);
            }


            if (result.length === 0 && curTime >= startTime) {
                recordMessage = true;
                result.push({
                    back0: backs[0],
                    back1: backs[1],
                    CPU0: Array.from(this.#CPU0),
                    CPU1: Array.from(this.#CPU1)
                })
            }

            let addMessage = function (message) {
                if (recordMessage) result.push(message);
            };

            for (let CPU of [this.#CPU0, this.#CPU1]) {
                let needPopOut = true;
                while (needPopOut) {
                    let [size, getSizeMessage] = CPU.getSize();
                    addMessage(...getSizeMessage);
                    addMessage(generateActionMessage(CPU.getName(), 'compare', ['size', 'zero'], [size, 0]));
                    if (size <= 0) {
                        addMessage(generateStateMessage(CPU.getName(), 'is empty'));
                        needPopOut = false;
                        break;
                    }
                    let [frontTaskTime, message] = CPU.peek();
                    addMessage(...message);
                    addMessage(generateActionMessage(CPU.getName(), 'compare', ['front task time', 'current time'], [frontTaskTime, curTime]));
                    if (frontTaskTime <= curTime) {
                        addMessage(generateStateMessage(CPU.getName(), 'need compare'));
                        let message = CPU.pop();
                        addMessage(...message);
                    }
                    else {
                        addMessage(generateStateMessage(CPU.getName(), 'finish compare'));
                        needPopOut = false;
                        break;
                    }
                }
            }

            let [size0, sizemessage0] = this.#CPU0.getSize();
            let [size1, sizemessage1] = this.#CPU1.getSize();
            addMessage(...sizemessage0);
            addMessage(...sizemessage1);

            addMessage(generateActionMessage('assignment', 'compare', ['size of CPU0', 'size of CPU1'], [size0, size1]));

            let targetCPU, targetIndex;
            if (size1 < size0) {
                targetCPU = this.#CPU1;
                targetIndex = 1;
            }
            else {
                targetCPU = this.#CPU0;
                targetIndex = 0;
            }

            addMessage(generateActionMessage('assignment', 'assign', targetCPU.getName(), `task ${task.getNumber()}`));
            let endTime = Math.max(curTime, backs[targetIndex]) + duration;
            addMessage(generateActionMessage(targetCPU.getName(), 'compare', ['current time + duration', 'back time + duration'], [curTime + duration, backs[targetIndex] + duration]));
            addMessage(generateActionMessage(targetCPU.getName(), 'update', `back${targetIndex}`, endTime));
            backs[targetIndex] = endTime;
            addMessage(...targetCPU.push({ taskNumber: task.getNumber(), endTime: endTime }));
        }

        return result;
    }
}

if (typeof window !== 'undefined') {
    window.Task = Task;
    window.AssignCPUTasks = AssignCPUTasks;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Task,
        Queue,
        AssignCPUTasks
    };
}

if (typeof require !== 'undefined' && require.main === module) {
    let tasks = [];
    let result = [];
    for (let i = 0; i < 5; i++) {
        let [newTask, messages] = Task.create(i, i, 1);
        tasks.push(newTask);
        // result.push(...messages);
    }

    let assignment;
    let messages;
    [assignment, messages] = AssignCPUTasks.create(tasks);
    // result.push(...messages);
    messages = assignment.assignTasks(1);
    result.push(...messages);

    console.log(result);
}