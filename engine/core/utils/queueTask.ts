import genericPool = require('generic-pool');
import _ = require('lodash');
import { sleep } from './time';
/**
 * 任务队列
 * 该队列已线性方式运行
 * 带有优先级
 */
export class QueueTask {
  queue: any;
  destroyed = false; //是否被销毁
  constructor(steps: Array<QueueTaskStep>) {
    this.queue = new genericPool.PriorityQueue(2);
    _.sortBy(steps, (v) => _.defaultTo(v.eta, 0)).forEach((v) => {
      // @ts-ignore
      v.promise = {
        catch: () => true,
      };
      this.queue.enqueue(v);
    });
  }

  async start() {
    while (true) {
      let task: QueueTaskStep = this.queue.dequeue();
      if (task == null) break; //结束
      if (task.eta) {
        let delayMs = task.eta - new Date().getTime();
        if (delayMs > 0) {
          await sleep(delayMs, console.log);
        }
      }
      if (this.destroyed) return;
      await task.action();
    }
  }
}

class QueueTaskStep {
  eta?: number; //到期才运行
  action: () => Promise<boolean>; //运行内容
}
