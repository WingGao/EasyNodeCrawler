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
  let sc = new SiteConfig('shuyueba');
  sc.name = '书悦';
  sc.host = 'www.lemao8.com';
  sc.https = true;
  sc.siteType = SiteType.Discuz; //Discuz! X3.4
  sc.toZh = false;
  // sc.charset = 'gbk';
  sc.saveBody = 0;
  sc.savePageResult = true;
  sc.myUsername = 'shaziniu';
  sc.myUserId = '17874';
  sc.myReplyMaxPerPage = Math.ceil(20 / 5);
  sc.cookie = cookies[sc.host].cookie;
  //上限配置
  sc.limit.reply = 33;
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
    // { id: '201', name: '新人报道', canShow: true },
    // { id: '53', name: '综合杂谈', canShow: true },
    // { id: '31', name: '开心此点', canShow: true },
    // { id: '94', name: '书迷基地', canShow: true },
    // { id: '161', name: '原创连载', canShow: true },
    // { id: '40', name: '新书快榜', canShow: true },
    // { id: '145', name: '连载发布', canShow: true },
    // { id: '151', name: '科技频道', canShow: true },
    // { id: '32', name: '美文品鉴', canShow: true },
    // { id: '126', name: '心灵旋律', canShow: true },
    // { id: '164', name: 'IQ智力比拼', canShow: true },
    // { id: '102', name: 'VIP交流区', canShow: false },
    // { id: '200', name: '日韩精华', canShow: true },
    // { id: '180', name: '在线看片', canShow: true },
    // { id: '111', name: '【发书区|严格审核】', canShow: true },
    // { id: '133', name: '☆YY小说', canShow: true },
    // { id: '125', name: '☆玄幻修真', canShow: true },
    // { id: '124', name: '☆武侠小说', canShow: true },
    // { id: '123', name: '☆都市校园', canShow: true },
    // { id: '122', name: '☆言情小说', canShow: true },
    // { id: '121', name: '☆游戏竞技', canShow: true },
    // { id: '120', name: '☆科幻小说', canShow: true },
    // { id: '118', name: '☆穿越历史', canShow: true },
    // { id: '119', name: '☆灵异盗墓', canShow: true },
    // { id: '116', name: '☆文学小说', canShow: true },
    // { id: '117', name: '☆军事小说', canShow: true },
    // { id: '115', name: '☆同人小说', canShow: true },
    // { id: '114', name: '☆其他小说', canShow: true },
    { id: '18', name: 'YY小说', canShow: true },
    // { id: '108', name: '重口味', canShow: true },
    // { id: '174', name: '举报建议', canShow: true },
    { id: '55', name: '玄幻修真', canShow: true },
    { id: '56', name: '武侠小说', canShow: true },
    { id: '57', name: '都市校园', canShow: true },
    { id: '58', name: '言情小说', canShow: true },
    { id: '59', name: '游戏竞技', canShow: true },
    { id: '60', name: '科幻小说', canShow: true },
    { id: '61', name: '灵异盗墓', canShow: true },
    { id: '62', name: '穿越历史', canShow: true },
    { id: '63', name: '军事小说', canShow: true },
    { id: '64', name: '文学小说', canShow: true },
    { id: '65', name: '同人小说', canShow: true },
    { id: '8', name: '其他小说', canShow: true },
    // { id: '6', name: '悬赏求书', canShow: true },
    // { id: '27', name: '美女图片', canShow: true },
    // { id: '177', name: '套图下载', canShow: true },
    // { id: '82', name: '漫画乐园', canShow: true },
    // { id: '84', name: '动作片|武打片|武侠片', canShow: true },
    // { id: '85', name: '科幻片|恐怖片|惊悚片', canShow: true },
    // { id: '86', name: '战争片|纪录片|冒险片', canShow: true },
    // { id: '87', name: '爱情片|喜剧片|剧情片', canShow: true },
    // { id: '90', name: '动漫片|动画片|奇幻片', canShow: true },
    // { id: '89', name: '综艺片|电视剧', canShow: true },
    // { id: '70', name: '垃圾美女', canShow: false },
    // { id: '91', name: '垃圾bt', canShow: false },
    // { id: '67', name: '垃圾动漫', canShow: false },
    // { id: '33', name: '游戏杂谈', canShow: true },
    // { id: '138', name: '游戏资源', canShow: true },
    // { id: '136', name: '网络游戏', canShow: true },
    // { id: '139', name: '即时策略', canShow: true },
    // { id: '140', name: 'RPG角色扮演', canShow: true },
    // { id: '141', name: '赛车游戏', canShow: true },
    // { id: '142', name: '模拟经营', canShow: true },
    // { id: '143', name: '益智休闲', canShow: true },
    // { id: '165', name: '手游资源', canShow: true },
    // { id: '137', name: 'GALGAME', canShow: true },
    // { id: '35', name: '游戏插件交流', canShow: true },
    // { id: '21', name: '电子书制作', canShow: true },
    // { id: '106', name: '账户名修改(停止)', canShow: false },
    // { id: '77', name: '站务公告', canShow: true },
    // { id: '13', name: '咨询(建议)', canShow: true },
    // { id: '24', name: '举报区', canShow: true },
    // { id: '156', name: '悔过崖', canShow: false },
    // { id: '147', name: '账号违规榜', canShow: true },
    // { id: '12', name: '版主交流', canShow: false },
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
  })();
}
