import * as IORedis from 'ioredis';
import { MainConfig } from './config';
import crypto = require('crypto');
const md5 = crypto.createHash('md5');
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
  static buildKeyMd5(prefix:string,key:string){
    return `${prefix}${md5.update(key).digest('hex')}`
  }
  static async setIfNull(key,onSet:()=>Promise<any>){
    let value = await this.inst().get(key)
    if(value == null){
      value = await onSet()
      await this.inst().set(key, value)
    }
    return value
  }
}
export function getArtRedis(): IORedis.Redis {
  if (artRedis == null) {
    artRedis = new IORedis(6380, '127.0.0.1', null);
  }
  return artRedis;
}
