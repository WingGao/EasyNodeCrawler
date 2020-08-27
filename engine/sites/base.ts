import { initConfig } from '../core';
import { SiteCrawler, SiteCrawlerDiscuz } from '../core/site';
import SpamNormal from '../spam/site/normal';
import * as yargs from 'yargs';
import { Post } from '../core/post';
import { SpamRecord } from '../spam/model';
import * as inquirer from 'inquirer';
import _ = require('lodash');
import { SiteConfig } from '../core/config';

abstract class BaseAction {
  cnf: SiteConfig;
  site: SiteCrawler;
  spam: SpamNormal;

  abstract init(): Promise<any>;
  async shui() {}
  async start() {
    await initConfig('config/dev.yaml');
    await this.init();

    let ua = { action: null };
    if (_.size(yargs.argv._) == 0) {
      ua = await inquirer.prompt({
        name: 'action',
        type: 'rawlist',
        message: '选择操作',
        choices: [
          { name: '获取链接', value: 'link' },
          { name: '获取详情', value: 'post' },
          { name: '灌水', value: 'shui' },
        ],
        default: 2,
      });
    } else {
      ua.action = yargs.argv._[0];
    }

    switch (ua.action) {
      case 'link': //爬取link
        await this.site.startFindLinks(this.cnf.ex.categorys);
        break;
      case 'post':
        this.site.startWorker();
        break;
      case 'shui':
        await this.shui();
        break;
    }
  }
}

export default BaseAction;
