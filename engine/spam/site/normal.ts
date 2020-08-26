import { LimitConfig, MainConfig, SiteConfig } from '../../core/config';
import * as fs from 'fs';
import * as path from 'path';
import _ = require('lodash');
import nn = require('node-notifier');
import { SiteCrawler } from '../../core/site';
import { SpamRecord } from '../model';
import { Post } from '../../core/post';
import { runSafe, sleep } from '../../core/utils';
import Redis from '../../core/redis';
import moment = require('moment');
import SiteSport163 from '../../core/site/sport163';

let haoList = null;
export default class SpamNormal {
  config: SiteConfig;
  crawler: SiteCrawler;
  sport163: SiteSport163;

  constructor(config: SiteConfig, crawler: SiteCrawler) {
    this.config = config;
    this.crawler = crawler;
    this.sport163 = new SiteSport163();
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
      onReply: (Post) => Promise<any>;
      samePostReplyPage?: number;
      checkPost?: (Post) => boolean; //判断post是否符合标准
      beforeSave?: (SpamRecord) => boolean;
      pageUrlExt?: string;
    },
  ): Promise<boolean> {
    cnf = _.merge(
      {
        samePostReplyPage: 1, //同一个帖子，自己重复会的间隔页数，1就是每个一页有一个回复
      },
      cnf,
    );
    let replyed = false;
    await this.crawler.loopCategory(
      cateId,
      async (posts) => {
        let myReplyNum = _.filter(posts, (p) => p._lastReplyUser.uname == this.config.myUsername).length;
        this.crawler.logger.debug('该页回复检测到', myReplyNum);
        if (myReplyNum >= this.config.myReplyMaxPerPage) {
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
          if (txt == null) continue;
          if (_.isString(txt)) {
            //只有string才发送
            await this.crawler.sendReplyLimit(post, txt);
          }
          record.myLastReplyPage = Math.ceil((post.replyNum + 1) / this.config.replyPageSize);
          if (cnf.beforeSave) {
            if (await cnf.beforeSave(record)) {
              await record.save();
            }
          } else {
            await record.save();
          }
          replyed = true;
          return false;
        }
        return true;
      },
      {
        pageUrlExt: cnf.pageUrlExt,
      },
    );
    return replyed;
    // await sleep(this.config.replyTimeSecond * 1000, (l) => this.crawler.logger.info(l));
  }
  async shuiCategoryPost(
    cateId,
    cnf: {
      onReply?: () => Promise<Post>;
      samePostReplyPage?: number;
      checkPost?: (Post) => boolean; //判断post是否符合标准
      beforeSave?: (SpamRecord) => boolean;
      pageUrlExt?: string;
      createExt?: any;
    },
  ): Promise<boolean> {
    let pageRes = await this.crawler.fetchPage(this.crawler.getPostListUrl(cateId));
    let myPostNum = _.filter(pageRes.posts, (p) => p.authorId == this.config.myUserId).length;
    this.crawler.logger.debug(`该页主题检测到 ${myPostNum}/${this.config.myPostMaxPerPage}`);
    if (myPostNum >= this.config.myPostMaxPerPage) {
      return false;
    }
    let cpost: Post;
    let post163 = false;
    if (cnf.onReply) cpost = await cnf.onReply();
    else {
      cpost = await this.getSport163Post();
      post163 = true;
    }
    cpost.categoryId = cateId;
    this.crawler.logger.info('创建主题', cpost.title, cpost.body.length);
    let res = await this.crawler.sendPost(cpost, cnf.createExt);
    if (!res) {
      return res;
    }
    if (post163) {
      //标记已使用
      let rec = new SpamRecord();
      rec.site = this.config.host;
      rec.pid = `163:${cpost.id}`;
      await rec.save();
    }
    return true;
  }

  // 获取非楼主的随机回复
  async gerRandomReply(post: Post, page: number) {
    let purl = this.crawler.getPostUrl(post.id, page);
    let np = _.cloneDeep(post);
    np.url = purl;
    let res = await this.crawler.fetchPost(np, { onlyMain: false });
    // 非楼主回复
    let replys = _.filter(
      res._replyList,
      (v) => v.authorId != post.authorId && v.body.length <= 20 && v.body.length > 4,
    );
    if (replys.length == 0) return null;
    return replys[_.random(0, replys.length - 1, false)];
  }

  // 随机获取网易的一篇文章
  async getSport163Post(onlyMain = true) {
    let post: Post;
    let dirtyWords = ['胸'];
    await this.sport163.loopCategory(null, async (posts) => {
      for (let p of posts) {
        let hasDirty = _.find(dirtyWords, (v) => p.title.indexOf(v) >= 0);
        if (hasDirty != null) {
          continue;
        }
        let rec = new SpamRecord();
        rec.site = this.config.host;
        rec.pid = `163:${p.id}`;
        let old = await rec.getById(rec.uniqId());
        if (old == null) {
          post = await this.sport163.fetchPost(p, { onlyMain });
          return false;
        }
      }
      return true;
    });
    return post;
  }

  // 把所有发帖的操作都放到一起
  async shuiTask(ps: Array<() => Promise<boolean>>) {
    while (true) {
      await runSafe(
        async () => {
          for (let p of ps) {
            let ok = await p();
            if (ok) {
              break;
            }
          }
        },
        async (e) => {
          this.crawler.logger.error(e);
          await sleep(60000);
          return false;
        },
      );
      await sleep(this.config.replyTimeSecond * 1000, (l) => this.crawler.logger.info(l));
    }
  }

  async isLimited(limitKey: keyof LimitConfig): Promise<boolean> {
    let maxVal = this.config.limit[limitKey];
    let redisKey = `${MainConfig.default().dataPrefix}:${this.config.host}:todayLimit:${limitKey}`;
    if (maxVal == 0) return true;
    else if (maxVal > 0) {
      let currentVal = await Redis.inst().get(redisKey);
      if (currentVal == null) return false;
      return parseInt(currentVal) >= maxVal;
    } else {
      return false;
    }
  }

  async doWithLimit(limitKey: keyof LimitConfig, action: () => Promise<boolean>) {
    let maxVal = this.config.limit[limitKey];
    let currentVal = 0;
    let redisKey = `${MainConfig.default().dataPrefix}:${this.config.host}:todayLimit:${limitKey}`;
    if (maxVal == 0) {
      //不允许
      this.crawler.logger.info('doWithLimit 不允许', limitKey, maxVal);
      return false;
    } else if (maxVal > 0) {
      //一般都是24小时内
      currentVal = await Redis.inst().incr(redisKey);
      if (currentVal == 1) {
        //设置过期
        let exp = moment().endOf('day').diff(moment());
        await Redis.inst().expire(redisKey, Math.ceil(exp / 1000 + 60));
      }
      if (currentVal > maxVal) {
        this.crawler.logger.info('doWithLimit 到达上限', limitKey, maxVal);
        return false;
      } else {
        this.crawler.logger.info(`doWithLimit ${limitKey} ${currentVal}/${maxVal}`);
      }
    }
    let dec = async () => {
      if (maxVal > 0) {
        //失败了就复原
        await Redis.inst().decr(redisKey);
      }
    };
    try {
      let res = await action();
      if (!res) {
        await dec();
      }
      return res;
    } catch (e) {
      await dec();
      throw e;
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
