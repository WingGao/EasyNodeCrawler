import { OpenCC } from 'opencc';
import _ = require('lodash');
const converter: OpenCC = new OpenCC('t2s.json'); //繁体转简体
export function getInt(s: string) {
  let g = /(\d+)/.exec(s);
  return parseInt(g[1]);
}

/**
 * 转为简体
 * @param ipt
 */
export async function toZhSimple(ipt) {
  if (_.size(ipt) == 0) return ipt;
  const result: string = await converter.convertPromise(ipt);
  return result;
}
