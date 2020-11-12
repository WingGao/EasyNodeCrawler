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
import { SpamRecord } from '../spam/model';
import inquirer = require('inquirer');
import BaseAction from './base';
import moment = require('moment');

export default function getConfig() {
  let sc = new SiteConfig('www.abooky.com');
  sc.name = '阅次元';
  sc.host = 'www.abooky.com';
  sc.https = true;
  sc.siteType = SiteType.Discuz; //Discuz! X3.4
  sc.toZh = false;
  // sc.charset = 'gbk';
  sc.saveBody = 0;
  sc.pageResultSave = true;
  sc.myUsername = 'shaziniu';
  sc.myUserId = '25248';
  sc.myReplyMaxPerPage = Math.ceil(20 / 5);
  sc.cookie = cookies[sc.host].cookie;
  //上限配置
  sc.limit.share = 3;
  sc.limit.vote = 2;
  sc.limit.promotionVisit = 2;
  sc.limit.reply = 10;
  sc.limit.thread = 5;
  sc.checkinUrl = '/plugin.php?id=k_misign:sign';
  sc.beforeReq = (options, done) => {
    done();
  };
  sc.crawler = {
    maxConnections: 2,
  };
  // sc.proxys = [{ type: 'http', host: '127.0.0.1', port: 18888 }];
  //sc.proxys = [{ type: 'sock5', host: '127.0.0.1', port: 8023 }];
  //要爬取的板块
  sc.ex.categorys = [
    // { "id": "117", "name": "灰色汉化组", "canShow": false },
    { id: '37', name: '审核' },
    { id: '38', name: '二次元' },
    { id: '39', name: '全本小说' },
    { id: '40', name: '常规' },
    { id: '42', name: '女频' },
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
      let spam = this.spam;
      let site = this.site as SiteCrawlerDiscuz;
      cnf.saveBody = 0;

      await spam.shuiTask([
        () =>
          spam.doWithLimit2('checkin', 1, async () => {
            await site.checkin();
            return true;
          }),
        async () => {
          let now = moment();
          if (now.hours() >= 8) {
            //8点后运行
            return false;
          }
          return true;
        },
        //投票
        async () => {
          if (await spam.isLimited('vote')) {
            site.logger.info('vote上限');
            return false;
          }
          cnf.replyTimeSecond = 30;
          return await spam.shuiCagegory('50', {
            pageUrlExt: '&filter=specialtype&orderby=dateline&specialtype=poll',
            onReply: async (p: Post) => {
              await spam.doWithLimit('vote', async () => {
                return await site.replyVote(p);
              });
              return true;
            },
            beforeSave: (r: SpamRecord) => {
              r.myLastReplyPage = 999;
              return true;
            },
          });
        },
        async () => {
          cnf.replyTimeSecond = (60 * 60) / 10; //1小时20帖
          return false;
        },
        //二次元小说
        () =>
          spam.doWithLimit('reply', () =>
            spam.shuiCagegory('38', {
              checkPost: (p: Post) => p.replyNum > cnf.replyPageSize * 2,
              onReply: async (p: Post) => {
                let re = await spam.gerRandomReply(p, 2);
                return re == null ? null : re.body;
              },
            }),
          ),
        //灌水，不让发帖
        // () =>
        //   spam.doWithLimit('thread', () =>
        //     spam.shuiCategoryPost('50', {
        //       createExt: {
        //         typeid: '27',
        //       },
        //     }),
        //   ),
      ]);
    }
  }

  new A().start();
}
