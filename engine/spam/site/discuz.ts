import SpamNormal, { ISpamActionConfig } from './normal';
import { SiteCrawlerDiscuz } from '../../core/site';
import { SiteConfig } from '../../core/config';
import { addCookie, getImageBase64, waitUntilLoad } from '../../core/utils';
import { By, until, WebDriver } from 'selenium-webdriver';
import _ = require('lodash');
import { sleep } from '../../core/utils';
import { Post } from '../../core/post';
import * as moment from 'moment';

import has = Reflect.has;

export default class SpamDiscuz extends SpamNormal {
  //   crawler: SiteCrawlerDiscuz;
  //
  //   constructor(config: SiteConfig) {
  //     let c = new SiteCrawlerDiscuz(config);
  //     super(config, c);
  //     this.crawler = c;
  //   }
  //
  //   /**
  //    * 检查表单有没有验证码
  //    * @param $
  //    */
  //   async checkCaptcha(driver?: WebDriver) {
  //     if (driver == null) driver = await this.crawler.getSelenium();
  //     let checkEle = await driver.findElement(By.id('seccheck')).catch((e) => null);
  //     if (checkEle != null) {
  //       //验证码服务
  //       // language=js
  //       let hash = await driver.executeScript(`
  //               return document.querySelector('input[name=seccodehash]').value
  //             `);
  //       await driver.findElement(By.id(`seccode${hash}`)).click();
  //       // 获取验证码图片
  //       //TODO 自动检测验证码
  //     }
  //   }
  //
  //   async createReply(tid) {
  //     let driver = await this.crawler.getSelenium();
  //     await driver.get(this.config.fullUrl(`/forum.php?mod=post&action=reply&extra=&tid=${tid}`));
  //     await driver.wait(until.elementLocated(By.id('e_textarea')));
  //     await driver.findElement(By.id('e_switcher')).click();
  //     // 切换到编辑器
  //     let repText = await this.getRandomText();
  //     // language=js
  //     await driver.executeScript(`
  //     // document.querySelector('#e_switchercheck').checked=true;
  // document.querySelector('#e_textarea').value=\`${repText}\`;
  //     `);
  //     //TODO 验证码
  //
  //     // 回复
  //     await driver.findElement(By.id('postsubmit')).click();
  //     this.crawler.logger.info('回复帖子', tid, repText);
  //   }
  //
  //   async getLastReplys(pid) {
  //     let p = new Post();
  //     p.id = pid;
  //     p.url = `/forum.php?mod=redirect&tid=${pid}&goto=lastpost#lastpost`;
  //     if (await this.crawler.fetchPost(p, { onlyMain: false })) {
  //       if (p._replyList.length < 3 && p._currentPage > 1) {
  //         let np = new Post();
  //         np.id = pid;
  //         np.url = `/thread-${pid}-${p._currentPage - 1}-1.html`;
  //         await this.crawler.fetchPost(np, { onlyMain: false });
  //         // 旧的在前
  //         p._replyList = np._replyList.concat(p._replyList);
  //       }
  //       return p;
  //     }
  //   }
  //
  //   // dsu签到
  //   async checkIn() {
  //     //https://bbs2.seikuu.com/plugin.php?id=dsu_paulsign:sign
  //   }
  //
  //   // 水楼，一直不停的回复某个帖子，禁止三连
  //   async shuiLou(tid, cf?: ISpamActionConfig) {
  //     cf = _.merge(
  //       {
  //         checkInterval: 5 * 60,
  //         maxContinuous: 3,
  //       },
  //       cf,
  //     );
  //     let sleepA = async () => {
  //       let st = Math.ceil(cf.checkInterval * 1000 * _.random(0.8, 1.1, true));
  //       let sts = moment.duration(st);
  //       this.crawler.logger.info('等待', sts.toISOString());
  //       await sleep(st);
  //     };
  //     while (true) {
  //       if (cf.sleepHourRange != null) {
  //         let d = new Date().getHours();
  //         if (d >= cf.sleepHourRange[0] && d <= cf.sleepHourRange[1]) {
  //           await sleepA();
  //           continue;
  //         }
  //       }
  //       let canReply = true;
  //       if (cf.maxContinuous > 0) {
  //         let post = await this.getLastReplys(tid);
  //         let cnt = 0;
  //         for (let i = post._replyList.length - 1; i >= 0; i--) {
  //           //倒序
  //           let reply = post._replyList[i];
  //           if (reply.authorId == this.config.myUserId) {
  //             cnt++;
  //           } else {
  //             cnt = 0;
  //             break;
  //           }
  //           if (cnt + 1 >= cf.maxContinuous) {
  //             //无法回复
  //             canReply = false;
  //             this.crawler.logger.info('检测连续回复数', cnt, '跳过发帖');
  //             break;
  //           }
  //         }
  //         //判断连续
  //       }
  //       if (canReply) {
  //         await this.createReply(tid);
  //       }
  //       await sleepA();
  //     }
  //   }
  //
  //   /**
  //    * 水板块
  //    * @param cateIds
  //    * @param cf
  //    */
  //   async shuiCategory(cateIds: Array<string>, cf?: ISpamActionConfig) {}
  //
  //   async start(args: { cates: Array<any> }) {}
  //
  //   async tt() {
  //     let driver = await this.crawler.getSelenium();
  //     await getImageBase64(driver, '.hdc.cl img');
  //   }
}
