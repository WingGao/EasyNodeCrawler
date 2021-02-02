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
import { getInt } from '../core/utils';

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
  //sc.proxys = [{ type: 'sock5', host: '127.0.0.1', port: 8023 }];
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
      // cnf.useGot = true;
      this.site = new SiteCrawlerDiscuz(cnf);
      this.spam = new SpamNormal(cnf, this.site);
    }
    async shui() {
      cnf.saveBody = 0;
      cnf.replyTimeSecond = (60 * 60) / 20; //1小时15帖
      let lastKuangTime = 0;
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
        // 检查圹
        async () => {
          let now = new Date().getTime();
          if (now - lastKuangTime >= 2 * 3600 * 1000) {
            lastKuangTime = now;
            await this.kuang();
          }
          return false;
        },
        //河洛茶馆
        () =>
          this.spam.doWithLimit('reply', () =>
            this.spam.shuiCagegory('9', {
              checkPost: (p: Post) => p.replyNum > cnf.replyPageSize * 2,
              onReply: async (p: Post) => {
                let re = await this.spam.gerRandomReply(p, 2);
                return re == null ? null : re.body;
              },
              maxPage: 5,
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
    // 矿场 自动领取+兑换
    async kuang() {
      this.site.logger.info('检查矿场');
      let rep = await this.site.axiosInst.get('/kuang.php');
      let $ = cheerio.load(rep.data);
      let $form = $('#kaicaiform_1');
      let $formHash = $form.find('input').filter((i, x) => _.get(x.attribs, 'name') == 'formhash');
      let hash = $formHash.attr('value');
      let pTxtDoms = $form.find('p.txt');
      for (let i = 0; i < pTxtDoms.length; i++) {
        let p = pTxtDoms[i];
        let txt = $(p).text();
        if (txt.indexOf('采得下品灵矿') >= 0) {
          this.site.logger.info(txt);
          let num = getInt(txt);
          if (num > 0) {
            // 领取
            this.site.logger.info('领取', num);
            let linRep = await this.site.axiosInst.get(`/kuang.php?mod=mining&op=lingqu&mineid=1&formhash=${hash}`);
            // this.site.logger.info(linRep.data);
          }
        }
      }
      // 兑换
    }
  }

  let siteA = new A();
  // (async () => {
  //   await siteA.prepare();
  //   await siteA.kuang();
  // })();

  siteA.start();
}
