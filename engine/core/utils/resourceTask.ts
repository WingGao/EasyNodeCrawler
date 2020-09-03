import genericPool = require('generic-pool');
import AsyncLock = require('async-lock');
import { EventEmitter } from 'events';
class ResourceTask<T> {
  pool;
  onDo;
  resQueue = new genericPool.Deque();
  cnf;
  lock = new AsyncLock();
  event = new EventEmitter();

  constructor(cnf: {
    create?: () => Promise<Array<T>>;
    createIter?: AsyncIterable<T>;
    max: number;
    onDo: (T) => Promise<any>;
  }) {
    this.cnf = cnf;
    this.pool = genericPool.createPool(
      {
        create: () => this.getNextResource(),
        destroy: async (r) => {},
      },
      {
        max: cnf.max,
        // testOnBorrow: true,
      },
    );
    this.onDo = cnf.onDo;
  }
  async getNextResource() {
    if (this.cnf.createIter) {
      let r = await this.cnf.createIter.next();
      if (r.done) {
        //完成
        this.event.emit('done');
        return null;
      }
      return r.value;
    }
    if (this.resQueue == null) return;

    let next = this.resQueue.shift();
    if (next == undefined) {
      let ls = await this.cnf.create();
      if (ls == null) {
        //没有资源了
        this.resQueue = null;
        return;
      }
      ls.forEach((v) => this.resQueue.push(v));
      next = this.resQueue.shift();
    }
    return next;
  }

  start() {
    for (let i = 0; i < this.pool.max; i++) {
      this.createWorker();
    }
  }

  async createWorker() {
    let r: T = await this.pool.acquire();
    if (r == null) {
      return;
    } //没了
    await this.onDo(r);
    //创建下一个
    this.createWorker();
    this.pool.destroy(r);
  }

  wait() {
    return new Promise((resolve) => {
      this.event.once('done', () => {
        this.pool.drain().then(() => {
          this.pool.clear();
        });
        resolve();
      });
    });
  }
}
export default ResourceTask;
