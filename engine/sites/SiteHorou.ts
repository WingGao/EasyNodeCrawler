/**
 * https://bbs2.seikuu.com/
 */
import { SiteConfig, SiteType } from '../core/config';
import { initConfig } from '../core';
import { SiteCrawlerDiscuz } from '../core/site';
import { Post } from '../core/post';
import cookies from './cookie';
import * as yargs from 'yargs';
import SpamDiscuz from '../spam/site/discuz';
import _ = require('lodash');
import SpamNormal from '../spam/site/normal';
import BaseAction from './base';
import cheerio = require('cheerio');

export default function getConfig() {
  let sc = new SiteConfig('www.horou.com');
  sc.name = '河洛中文社区';
  sc.host = 'www.horou.com';
  sc.https = true;
  sc.siteType = SiteType.Discuz; //Discuz! X3.4
  sc.toZh = false;
  sc.charset = 'gbk';
  sc.saveBody = 0;
  sc.pageResultSave = true;
  sc.myUsername = 'shaziniu1';
  sc.myUserId = '334371';
  sc.myReplyMaxPerPage = 8;
  sc.limit.reply = 98;
  sc.checkinUrl = '/plugin.php?id=k_misign:sign';
  sc.cookie = cookies[sc.host].cookie;
  sc.beforeReq = (options, done) => {
    done();
  };
  sc.crawler = {
    maxConnections: 2,
  };
  // sc.proxys = [{ type: 'http', host: '127.0.0.1', port: 18888 }];
  sc.proxys = [{ type: 'sock5', host: '127.0.0.1', port: 8023 }];
  //要爬取的板块
  sc.ex.categorys = [
    // { "id": "117", "name": "灰色汉化组", "canShow": false },
    { id: '193', name: '全本精校', canShow: false },
  ];
  return sc;
}

if (require.main === module) {
  let cnf;
  class A extends BaseAction {
    async init(): Promise<any> {
      cnf = getConfig();
      this.cnf = cnf;
      this.site = new SiteCrawlerDiscuz(cnf);
      this.spam = new SpamNormal(cnf, this.site);
    }
    async shui() {
      cnf.saveBody = 0;
      cnf.replyTimeSecond = (60 * 60) / 20; //1小时15帖
      await this.spam.shuiTask([
        () =>
          this.spam.doWithLimit2('checkin', 1, async () => {
            await this.site.checkin();
            await this.task(27); //潜水
            await this.task(26); //回20贴
            return true;
          }),
        //检查任务
        () => this.task(26, false),
        //河洛茶馆
        () =>
          this.spam.doWithLimit('reply', () =>
            this.spam.shuiCagegory('9', {
              checkPost: (p: Post) => p.replyNum > cnf.replyPageSize * 2,
              onReply: async (p: Post) => {
                let re = await this.spam.gerRandomReply(p, 2);
                return re == null ? null : re.body;
              },
            }),
          ),
      ]);
    }
    // 接任务
    async task(tid, start = true) {
      let rep = await this.site.axiosInst.get(`/home.php?mod=task&do=${start ? 'apply' : 'draw'}&id=${tid}`);
      let $ = cheerio.load(rep.data);
      this.site.logger.info('任务', tid, $('#messagetext').text().trim());
      // return rep.data;
      return false;
    }
  }

  new A().start();
}
