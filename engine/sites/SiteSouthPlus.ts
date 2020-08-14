/**
 * https://bbs2.seikuu.com/
 */
import { SiteConfig, SiteType } from '../core/config';
import { initConfig } from '../core';
import { SiteCrawlerDiscuz, SiteCrawlerPhpwind } from '../core/site';
import { Post } from '../core/post';
import cookies from './cookie';
import * as yargs from 'yargs';
import SpamDiscuz from '../spam/site/discuz';
import _ = require('lodash');
import SpamNormal from '../spam/site/normal';
import { sleep } from '../core/utils';

export default function getConfig() {
  let sc = new SiteConfig();
  sc.name = '南+';
  sc.host = 'south-plus.net';
  sc.https = true;
  sc.siteType = SiteType.Phpwind; // Pu!mdHd v0.7β
  sc.toZh = true;
  sc.saveBody = 2;
  sc.myUsername = 'f33fb3e5';
  sc.myUserId = '1191215';
  sc.cookie = cookies[sc.host].cookie;
  sc.replyPageSize = 30;
  sc.myReplyMaxPerPage = 8;
  sc.postBlacklist = [
    '501667', //关于三次元儿童色情的再次警告和说明
  ];
  sc.getHeaders = () => {
    return {
      cookie: sc.cookie,
    };
  };
  sc.beforeReq = (options, done) => {
    done();
  };
  sc.crawler = {
    maxConnections: 2,
  };
  // sc.proxys = [{ type: 'http', host: '127.0.0.1', port: 18888 }];
  sc.proxys = [{ type: 'sock5', host: '127.0.0.1', port: 8023 }];
  //要爬取的板块
  sc.ex.categorys = [];
  let categorys = [
    [
      { id: '136', name: 'Comic Market 98' },
      { id: '190', name: '同人志&CG' },
      { id: '191', name: '同人志&CG (图墙模式)' },
      { id: '192', name: '游戏' },
      { id: '193', name: '音乐' },
      { id: '107', name: 'Comic Market 97' },
      { id: '183', name: '同人志&CG' },
      { id: '184', name: '同人志&CG (图墙模式)' },
      { id: '185', name: '游戏' },
      { id: '186', name: '音乐' },
      { id: '44', name: 'サンクリ' },
      { id: '103', name: '图墙模式' },
      { id: '46', name: 'Comic1☆16' },
      { id: '104', name: '图墙模式' },
      { id: '47', name: '其他同人志' },
      { id: '105', name: '图墙模式' },
      { id: '16', name: '一般漫画' },
      { id: '20', name: '原版交流' },
      { id: '45', name: '例大祭&紅楼夢' },
      { id: '106', name: '图墙模式' },
      { id: '36', name: '汉化本发布' },
      { id: '102', name: '图墙模式' },
      { id: '43', name: '旧物仓库' },
      { id: '189', name: 'C96' },
      { id: '182', name: 'C95' },
      { id: '176', name: 'C94' },
      { id: '164', name: 'C93' },
      { id: '158', name: 'C92' },
      { id: '152', name: 'C91' },
      { id: '144', name: 'C90' },
      { id: '143', name: 'C89' },
      { id: '129', name: 'C88' },
      { id: '116', name: 'C87' },
      { id: '97', name: 'C86' },
      { id: '78', name: 'C85' },
      { id: '89', name: 'C84' },
      { id: '30', name: 'C83' },
      { id: '67', name: 'C82' },
      { id: '62', name: 'C81' },
      { id: '55', name: 'C80' },
      { id: '53', name: 'C79' },
      { id: '54', name: 'C78' },
      { id: '124', name: '- 蜜柑计划 - Mikan Project' },
      { id: '8', name: 'ACG交流' },
      { id: '12', name: '轻小说' },
      { id: '83', name: '自扫小说图源区' },
      { id: '17', name: '原创绘画' },
      { id: '48', name: '询问&求物' },
      { id: '9', name: '茶馆' },
      { id: '188', name: '茶楼' },
      { id: '13', name: '免空资源区' },
      { id: '14', name: 'CG资源' },
      { id: '128', name: '同人音声' },
      { id: '4', name: '实用动画' },
      { id: '73', name: '高清里番' },
      { id: '5', name: '实用漫画' },
      { id: '109', name: '图墙模式' },
      { id: '6', name: '游戏资源' },
      { id: '135', name: 'GALGAME汉化区' },
      { id: '142', name: 'GALGAME汉化区 (图墙模式)' },
      { id: '170', name: '网赚资源区' },
      { id: '171', name: 'CG资源' },
      { id: '172', name: '实用动画' },
      { id: '173', name: '实用漫画' },
      { id: '174', name: '游戏资源' },
      { id: '2', name: '事务受理' },
    ],
  ];
  return sc;
}

if (require.main === module) {
  (async () => {
    await initConfig('config/dev.yaml');
    let cnf = getConfig();
    let site = new SiteCrawlerPhpwind(cnf);
    let spam = new SpamNormal(cnf, site);
    // await spam.tt();
    if (_.size(yargs.argv._) == 0) {
      site.startWorker();
    } else {
      switch (yargs.argv._[0]) {
        case 'shui':
          await spam.shuiTask([
            //同人音声
            () =>
              spam.shuiCagegory('128', {
                onReply: async (p) => {
                  return '感 [s:701] 谢 [s:692] 分[s:705] 享 [s:692] ';
                },
              }),
            //水楼
            () =>
              spam.shuiCagegory('9', {
                checkPost: (p: Post) => p.replyNum > cnf.replyPageSize * 2,
                onReply: async (p: Post) => {
                  let re = await spam.gerRandomReply(p, 2);
                  return re == null ? null : re.body;
                },
              }),
            // 求物，无sp
            () =>
              spam.shuiCagegory('48', {
                onReply: async () => '玛珂一个 [s:692] 菠萝',
                checkPost: (p: Post) => p.replyNum > 10,
              }),
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
