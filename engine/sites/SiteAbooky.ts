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

export default function getConfig() {
  let sc = new SiteConfig('www.abooky.com');
  sc.name = '阅次元';
  sc.host = 'www.abooky.com';
  sc.https = true;
  sc.siteType = SiteType.Discuz; //Discuz! X3.4
  sc.toZh = false;
  // sc.charset = 'gbk';
  sc.saveBody = 0;
  sc.savePageResult = true;
  sc.myUsername = 'shaziniu';
  sc.myUserId = '25248';
  sc.myReplyMaxPerPage = Math.ceil(20 / 5);
  sc.cookie = cookies[sc.host].cookie;
  //上限配置
  sc.limit.share = 3;
  sc.limit.vote = 2;
  sc.limit.promotionVisit = 2;
  sc.limit.reply = 33;
  sc.limit.thread = 5;
  sc.checkinUrl = '/plugin.php?id=k_misign:sign';
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
    { id: '37', name: '审核' },
    { id: '38', name: '二次元' },
    { id: '39', name: '全本小说' },
    { id: '40', name: '常规' },
    { id: '42', name: '女频' },
  ];
  return sc;
}

if (require.main === module) {
  (async () => {
    await initConfig('config/dev.yaml');
    let cnf = getConfig();
    let site = new SiteCrawlerDiscuz(cnf);
    let spam = new SpamNormal(cnf, site);

    let ua = await inquirer.prompt({
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

    switch (ua.action) {
      case 'link': //爬取link
        await site.startFindLinks(cnf.ex.categorys);
        break;
      case 'post':
        site.startWorker();
        break;
      case 'shui':
        //先签到
        await site.checkin();
        cnf.replyTimeSecond = 30;
        await spam.shuiTask([
          //投票
          async () => {
            if (await spam.isLimited('vote')) {
              site.logger.info('vote上限');
              return false;
            }
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
        break;
    }

    // await site.checkCookie();
    // await site.listCategory();
    // await site.fetchPage(site.config.ex.categorys[0].id);
    // await site.startFindLinks();
    //
    // let post = new Post();
    // // post.site = site.config.host;
    // // post.id = '241331';
    // // post.url = '/forum.php?mod=viewthread&tid=241331';
    // // //繁体
    // post.id = '239842';
    // post.url = '/forum.php?mod=viewthread&tid=239842';
    // await site.fetchPost(post);
    // site.startWorker();
  })();
}
