import { SiteConfig } from '../../core/config';
import * as fs from 'fs';
import * as path from 'path';
import _ = require('lodash');
import nn = require('node-notifier');
import { SiteCrawler } from '../../core/site';
import { SpamRecord } from '../model';
import { Post } from '../../core/post';
import { runSafe, sleep } from '../../core/utils';

let haoList = null;
export default class SpamNormal {
  config: SiteConfig;
  crawler: SiteCrawler;

  constructor(config: SiteConfig, crawler: SiteCrawler) {
    this.config = config;
    this.crawler = crawler;
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

  // 水某一个板块
  async shuiCagegory(
    cateId,
    cnf: {
      onReply: (Post) => Promise<string>;
      samePostReplyPage?: number;
      checkPost?: (Post) => boolean; //判断post是否符合标准
    },
  ) {
    cnf = _.merge(
      {
        samePostReplyPage: 1, //同一个帖子，自己重复会的间隔页数，1就是每个一页有一个回复
      },
      cnf,
    );
    let replyed = false;
    await this.crawler.loopCategory(cateId, async (posts) => {
      let myReplyNum = _.filter(posts, (p) => p._lastReplyUser.uname == this.config.myUsername)
        .length;
      this.crawler.logger.debug('该页回复检测到', myReplyNum);
      if (myReplyNum >= this.config.replyPageSize) {
        this.crawler.logger.info('触发防止屠版');
        return false; //防止屠版
      }
      for (let post of posts) {
        if (cnf.checkPost && !cnf.checkPost(post)) continue;
        let record = new SpamRecord();
        record.site = post.site;
        record.pid = post.id;
        record.categoryId = cateId;
        let old = await record.getById(record.uniqId());
        if (old == null) {
        } else {
          //判断是否在一页上
          let lastPage = Math.ceil(post.replyNum / this.config.replyPageSize);
          if (lastPage - old.myLastReplyPage >= cnf.samePostReplyPage) {
            //距离够了
          } else {
            continue; //跳过
          }
        }
        // 创建回复
        let txt = await cnf.onReply(post);
        await this.crawler.sendReplyLimit(post, txt);
        record.myLastReplyPage = Math.ceil((post.replyNum + 1) / this.config.replyPageSize);
        await record.save();
        replyed = true;
        return false;
      }
      return true;
    });
    return replyed;
    // await sleep(this.config.replyTimeSecond * 1000, (l) => this.crawler.logger.info(l));
  }

  // 把所有发帖的操作都放到一起
  async shuiTask(ps: Array<() => Promise<boolean>>) {
    while (true) {
      await runSafe(async () => {
        for (let p of ps) {
          let ok = await p();
          if (ok) {
            break;
          }
        }
      });
      await sleep(this.config.replyTimeSecond * 1000, (l) => this.crawler.logger.info(l));
    }
  }

  async tt() {
    //
  }
}

export interface ISpamActionConfig {
  checkInterval?: number;
  maxContinuous?: number;
  sleepHourRange?: number[]; //在这段时间内不工作
}
