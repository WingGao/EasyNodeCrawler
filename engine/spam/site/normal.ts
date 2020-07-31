import { SiteConfig } from '../../core/config';
import * as fs from 'fs';
import * as path from 'path';
import _ = require('lodash');

let haoList = null;
export default class SpamNormal {
  config: SiteConfig;
  constructor(config: SiteConfig) {
    this.config = config;
  }

  async start(args: any) {}

  // 语料库 http://corpus.zhonghuayuwen.org/CnCindex.aspx
  async getRandomText() {
    if (haoList == null) {
      haoList = fs.readFileSync(path.resolve(__dirname, '../txt/hao.txt')).toString().split('\n');
    }
    return haoList[_.random(0, haoList.length - 1)];
  }
}

export interface ISpamActionConfig {
  checkInterval?: number;
  maxContinuous?: number;
}
