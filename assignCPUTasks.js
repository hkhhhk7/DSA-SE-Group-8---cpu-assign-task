function generateTypeError(variantName, targetType, functionName) {
    return `${variantName} is not instance of "${targetType}" in ${functionName}`
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
        return [createdTask, [`create Task ${createdTask.getNumber()}`]]
    }

    getStartTime() {
        return [this.#startTime, [`task ${this.#number}: get start time ${this.#startTime}`]];
    }

    getDuration() {
        return [this.#duration, [`task ${this.#number}: get duration ${this.#duration}`]];
    }

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
        return [createdQueue, [`create Queue ${createdQueue.getName()}`]];
    }

    push(data) {
        // data should be number here
        let result = [];
        this.#size += 1; result.push(`${this.#name}: size increases 1`);
        this.#data.push(data); result.push(`${this.#name}: pushes ${data} to index ${this.#size - 1}`);
        return result;
    }

    pop() {
        let result = [];
        result.push(`${this.#name}: ${this.#data[0]} is poped out`);
        this.#size -= 1; result.push(`${this.#name}: size decreases 1`);

        // move the data for animation
        for (let i = 0; i < this.#size; i++) {
            result.push(`${this.#name}: ${this.#data[i + 1]} is moved to ${i}`);
            this.#data[i] = this.#data[i + 1];
        }

        return result;
    }

    peek() {
        return [this.#data[0], [`${this.#name}: peek ${this.#data[0]}`]];
    }

    getSize() {
        return [this.#size, [`${this.#name}: size ${this.#size}`]];
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
            (a, b) => (a.getStartTime() <= b.getStartTime())
        );
    }

    static create(tasks) {
        let createdAssignCPUTasks = new AssignCPUTasks(tasks);
        let createMessage0, createMessage1;
        [createdAssignCPUTasks.#CPU0, createMessage0] = Queue.create("CPU0");
        [createdAssignCPUTasks.#CPU1, createMessage1] = Queue.create("CPU1");

        return [createdAssignCPUTasks, [...createMessage0, ...createMessage1]];
    }

    assignTasks() {
        let result = [];
        let backs = [0, 0];
        result.push("create back0: 0, back1: 0");
        for (const task of this.#tasks) {
            // fist step: pop out executed processes
            let [curTime, message0] = task.getStartTime();
            let [duration, message1] = task.getDuration();
            result.push(...message0);
            result.push(...message1);

            let needPopOut = true;
            for (let CPU of [this.#CPU0, this.#CPU1]) {
                while (needPopOut) {
                    let [frontTaskTime, message] = CPU.peek();
                    result.push(...message);
                    result.push(`${CPU.getName()}: update front task time ${frontTaskTime} with current time ${curTime}`);
                    if (frontTaskTime <= curTime) {
                        result.push(`${CPU.getName()}: finished before current time`)
                        let message = CPU.pop();
                        result.push(...message);
                    }
                    else {
                        result.push(`${CPU.getName()}: up to date`);
                        needPopOut = false;
                    }
                }
            }

            let [size0, sizemessage0] = this.#CPU0.getSize();
            let [size1, sizemessage1] = this.#CPU1.getSize();
            result.push(...sizemessage0);
            result.push(...sizemessage1);

            result.push(`compare tasks in CPU0 ${size0} and CPU1 ${size1}`);

            let targetCPU, targetIndex;
            if (size1 > size0) {
                targetCPU = this.#CPU1;
                targetIndex = 1;
            }
            else {
                targetCPU = this.#CPU0;
                targetIndex = 0;
            }

            result.push(`assign task ${task.number} to ${targetCPU.getName()}`)
            let endTime = Math.max(curTime + duration, backs[targetIndex] + duration); result.push(`end time of ${targetCPU.getName()}: ${endTime}`);
            backs[targetIndex] = result.push(`update back${targetIndex} to ${backs[targetIndex]}`);
        }

        return result;
    }
}

let tasks = [];
let result = [];
for (let i = 0; i < 5; i++) {
    let [newTask, messages] = Task.create(i, i, 1);
    tasks.push(newTask);
    result.push(...messages);
}


let [assignment, messages] = AssignCPUTasks.create(tasks);
result.push(...messages);
messages = assignment.assignTasks();
result.push(...messages);

console.log(result);