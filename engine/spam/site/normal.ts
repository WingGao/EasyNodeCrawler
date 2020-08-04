import { SiteConfig } from '../../core/config';
import * as fs from 'fs';
import * as path from 'path';
import _ = require('lodash');
import nn = require('node-notifier');

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

  waitForUserAction(msg: String) {
    return new Promise((resolve) => {
      nn.notify({
        title: 'NodeSpam',
        message: msg,
        sound: true,
        wait: true,
      });
      nn.on('click', (notifierObject, options, event) => {
        console.log(notifierObject, options, event);
        // Triggers if `wait: true` and user clicks notification
      });
    });
  }
}

export interface ISpamActionConfig {
  checkInterval?: number;
  maxContinuous?: number;
  sleepHourRange?: number[]; //在这段时间内不工作
}
