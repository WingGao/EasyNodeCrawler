import _ = require('lodash');
import * as iconv from 'iconv-lite';
import FormData = require('form-data');
let converter  //繁体转简体
export function getInt(s: string) {
  let g = /(\d+)/.exec(s);
  return parseInt(g[1]);
}

/**
 * 转为简体
 * @param ipt
 */
export async function toZhSimple(ipt) {
  if(converter == null){
    // const cc = await import('opencc').catch((e)=>{
    //   console.error(e)
    //   //mock一个客户端
    //   function FakeOpenCC(){
    //
    //   }
    //   FakeOpenCC.prototype.convertPromise = async (s)=>{
    //     return s
    //   }
    //   return {
    //     OpenCC: FakeOpenCC
    //   }
    // })
    // // @ts-ignore
    // converter =  new cc.OpenCC('t2s.json'); //繁体转简体
  }
  if (_.size(ipt) == 0) return ipt;
  const result: string = await converter.convertPromise(ipt);
  return result;
}

export function toFormData(o): FormData {
  let data = new FormData();
  _.forEach(o, (v, k) => {
    data.append(k, v);
  });
  return data;
}
