import IORedis = require('ioredis');
import { MainConfig } from './config';

let redis: IORedis.Redis;
let artRedis: IORedis.Redis;
export default class Redis {
  static inst() {
    if (redis == null) {
      let rc = MainConfig.default().redis;
      redis = new IORedis(rc.port, rc.host, null);
    }
    return redis;
  }

  static async lock(key: string, seconds: number = 5 * 60) {
    let rep = await this.inst().incr(key);
    if (rep == 1) {
      await this.inst().expire(key, seconds); //设置超时
      return true;
    } else {
      return false;
    }
  }

  static async unlock(key: string) {
    await this.inst().del(key);
  }
}
export function getArtRedis(): IORedis.Redis {
  if (artRedis == null) {
    artRedis = new IORedis(6380, '127.0.0.1', null);
  }
  return artRedis;
}
