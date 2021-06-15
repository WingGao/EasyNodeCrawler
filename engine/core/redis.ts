import * as IORedis from 'ioredis';
import { MainConfig } from './config';
import crypto = require('crypto');
import { val } from "cheerio/lib/api/attributes";
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
    const md5 = crypto.createHash('md5');
    return `${prefix}${md5.update(key).digest('hex')}`
  }
  static async setIfNull(key,onSet:()=>Promise<any>){
    let value = await this.inst().get(key)
    if(value == null){
      value = await onSet()
        let sv = value
      if(typeof sv != 'string'){
          sv = JSON.stringify(value)
      }
      await this.inst().set(key, sv)
    }else{
      if(value.startsWith('{')){
        value = JSON.parse(value)
      }
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
