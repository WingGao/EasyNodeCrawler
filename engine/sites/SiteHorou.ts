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

export default function getConfig() {
  let sc = new SiteConfig('www.horou.com');
  sc.name = '河洛中文社区';
  sc.host = 'www.horou.com';
  sc.https = true;
  sc.siteType = SiteType.Discuz; //Discuz! X3.4
  sc.toZh = false;
  sc.charset = 'gbk';
  sc.saveBody = 2;
  sc.myUsername = 'shaziniu1';
  sc.myUserId = '334371';
  sc.myReplyMaxPerPage = 8;
  sc.replyTimeSecond = (60 * 60) / 15; //1小时15帖
  sc.limit.reply = 98;
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
  ];
  return sc;
}

if (require.main === module) {
  (async () => {
    await initConfig('config/dev.yaml');
    let cnf = getConfig();
    let site = new SiteCrawlerDiscuz(cnf);
    let spam = new SpamNormal(cnf, site);
    if (_.size(yargs.argv._) == 0) {
      site.startWorker();
    } else {
      switch (yargs.argv._[0]) {
        case 'shui':
          cnf.saveBody = 0;
          await spam.shuiTask([
            //河洛茶馆
            () =>
              spam.doWithLimit('reply', () =>
                spam.shuiCagegory('9', {
                  checkPost: (p: Post) => p.replyNum > cnf.replyPageSize * 2,
                  onReply: async (p: Post) => {
                    let re = await spam.gerRandomReply(p, 2);
                    return re == null ? null : re.body;
                  },
                }),
              ),
          ]);
          break;
      }
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
