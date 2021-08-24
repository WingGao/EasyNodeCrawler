import * as moment from 'moment';
import { Moment } from 'moment';

export function sleep(ms, logg?) {
    if (ms <= 0) return Promise.resolve();
    if (logg != null) {
        logg(['sleep', moment.duration(ms).toISOString(), moment().add(ms, 'ms')]);
    }
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
}

export class Progress {
    total: number = 0;
    lastTime: Moment;
    count: number = 0;
    records = []; //保留最近的5个耗时
    recTotalTimeSec = 0;

    constructor(total = 0) {
        this.total = total;
    }

    incr(step = 1) {
        this.count += step;
        if (this.records.length >= 5) {
            let l = this.records.splice(0, 1);
            this.recTotalTimeSec -= l[0];
        }
        let now = moment();
        let du = this.lastTime == null ? 0 : now.diff(this.lastTime) / 1000;
        this.records.push(du);
        this.recTotalTimeSec += du;
        this.lastTime = now;
    }

    progress() {
        let restTimeSec = 0;
        if (this.count > 0) {
            let avg = this.recTotalTimeSec / this.records.length;
            restTimeSec = avg * (this.total - this.count);
        }

        return { count: this.count, total: this.total, remainSecond: restTimeSec };
    }

    fmt() {
        let r = this.progress();
        let remain = moment.duration(r.remainSecond, 'second');
        return `进度：${r.count}/${r.total}(${((r.count * 100) / r.total).toFixed(2)}%) 剩余时间：${remain.toISOString()}`;
    }

    reset() {
        this.total = 0;
        this.count = 0;
        this.records = [];
        this.recTotalTimeSec = 0;
        this.lastTime = null;
    }
}

export class TimeLimiter {
    delayMs: number
    lastRunTime = 0

    constructor(delayMs: number) {
        this.delayMs = delayMs
    }

    async wait() {
        let currTime = new Date().getTime()
        let cDelayMs = this.delayMs - (currTime - this.lastRunTime)
        if (cDelayMs > 0) await sleep(cDelayMs)
        this.lastRunTime = currTime
    }
}
