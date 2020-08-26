import path = require('path');
import fs = require('fs');
import { randomChoice } from './obj';
import { Netmask, ip2long, long2ip } from 'netmask';
import _ = require('lodash');

let cn_ip_masks;
export function randomCnIP() {
  if (cn_ip_masks == null) {
    cn_ip_masks = fs
      .readFileSync(path.resolve(__dirname, 'china_ip_list.txt'))
      .toString()
      .split('\n')
      .map((v) => {
        return v.trim();
      });
  }
  let mask = randomChoice(cn_ip_masks);
  let block = new Netmask(mask);
  let rid = _.random(0, block.size);
  let ip = ip2long(block.first) + rid;
  let ipStr = long2ip(ip);
  return ipStr;
}
