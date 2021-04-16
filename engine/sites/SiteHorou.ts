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
import { getInt, sleep } from '../core/utils';
import qs = require('qs');
import { QueueTask } from '../core/utils/queueTask';
import moment = require('moment');
import { PluginLuckypost } from '../core/site/discuz/plugin-luckypost';
import axios from 'axios';

const ReplyLimitNum = 20;

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
  sc.limit.reply = ReplyLimitNum; // 98;
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

class LandInfo {
  id: number;
  kind: string;
  num?: number;
  endTime?: Date; //成熟时间
  canSou: false; //能否收获

  static EMPTY = 'thispop'; //空地
  static FARMING = 'thisfarm'; //生长中
  static NOTBUY = 'thiskuozhan'; //买地
}

class PluginJfarm {
  site: SiteCrawlerDiscuz;
  formHash: string;
  lands: LandInfo[];
  store = [];
  /**
   * 默认种子
   * 1=小麦
   * 2=胡萝卜
   * 5=玉米
   * 6=土豆 收获经验4
   */
  defaultSeedId = 6;

  health = 0; //体力
  healthMax = 0;
  nextHealthEta: Date;
  exp = 0; //经验

  static TYPE_PROD = 'prod';

  constructor(site) {
    this.site = site;
  }

  async fetchIndex() {
    let rep = await this.site.axiosInst.get('/plugin.php?id=jnfarm');
    this.formHash = /formhash=(\w+)/.exec(rep.data)[1];

    let $ = cheerio.load(rep.data);
    await this.refreshLands({ html: rep.data });
    let $userDivs = $('#userinfo').find('>div');
    let exp = $userDivs.eq(1).find('.layui-progress-bar').attr('lay-percent').split('/')[0];
    this.exp = parseInt(exp);
    let $heathDiv = $userDivs.eq(2);
    let healthTxt = $heathDiv.text().trim().split('/');
    this.health = parseInt(healthTxt[0]);
    this.healthMax = parseInt(healthTxt[1]);
    let $healTime = $heathDiv.find('i').eq(1);
    let healTimeT = $healTime.attr('onclick');
    let g = /([\d:]+)\)/.exec(healTimeT);
    // this.nextHealthEta =
    this.site.logger.info(`[PluginJfarm] formHash=${this.formHash} 土地数量=${this.lands.length} 体力=${this.health}/${this.healthMax} 经验=${this.exp}`);
  }

  async refreshLands({ html }) {
    if (html == null) {
    }
    let $ = cheerio.load(html);
    this.lands = [];
    $('div.isometricbtn').each((i, v) => {
      let $div = $(v);
      let $a = $div.parent();
      let land = new LandInfo();
      land.id = parseInt($a.attr('data-jfid'));
      land.kind = $a.attr('class');
      if (land.kind != LandInfo.NOTBUY) {
        this.lands.push(land);
      }
    });
  }

  async fetchApi(conf: { do?: string; ac?: string; landId?: any; ex?: any; ajax?: boolean }) {
    let pa = {
      do: _.defaultTo(conf.do, 'normal'),
      ac: conf.ac,
      jfid: conf.landId,
      timestamp: Math.floor(new Date().getTime() / 1000),
      jhash: this.formHash,

      ...conf.ex,
    };
    if (conf.ajax != false) {
      pa.inajax = 1;
      pa.ajaxtarget = 'try';
    }
    let q = qs.stringify(pa);
    let rep = await this.site.axiosInst.get(`/plugin.php?id=jnfarm&${q}`);

    let html = this.site.parseAjaxXml(rep.data);
    let $ = cheerio.load(html);
    return $;
  }

  // 仓库信息
  async fetchStore() {
    let $ = await this.fetchApi({ ac: 'store' });
    this.store = [];
    $('#jnfarm_pop > div')
      .eq(1)
      .find('>div')
      .each((i, div) => {
        let $div = $(div);
        if ($div.attr('style').indexOf('width:33%') >= 0) {
          let $aName = $div.find('>div>a');
          let nameNode = _.find($aName[0].children, (v) => v.type == 'text');
          let g = /(\d+),'(\w+)'/.exec($aName.attr('onclick'));
          let item = {
            id: parseInt(g[1]),
            name: nameNode.data.trim(),
            type: g[2],
            num: parseInt($div.find('input').eq(1).val()),
          };
          //奇怪的映射
          if (item.id == 3 && item.type == 'seed') item.id = 5;
          if (item.id == 4 && item.type == 'seed') item.id = 6;
          this.store.push(item);
        }
      });
    this.site.logger.info(`[PluginJfarm] 更新仓库 ${JSON.stringify(this.store)}`);
  }

  async doBuySeed(num = 1, seedId?) {
    let bsi = _.defaultTo(seedId, this.defaultSeedId); //购买种子id
    let p = {
      do: 'shop',
      timestamp: Math.ceil(new Date().getTime() / 1000),
      formhash: this.formHash,
      submit: 'true',
    };
    p[`jsid[${bsi}]`] = 1;
    p[`qty[${bsi}]`] = num;
    let q = qs.stringify(p);
    let rep = await this.site.axiosInst.get(`/plugin.php?id=jnfarm&${q}`);
    this.site.logger.info(JSON.parse(rep.data).final);
    await this.fetchStore();
  }

  getSeed() {
    return _.find(this.store, (v) => v.type == 'seed' && v.num > 0);
  }

  // 播种
  async doLandSeed(landId) {
    if (this.health <= 0) {
      throw new Error('没有体力了');
    }
    let seed = this.getSeed();
    if (seed == null) {
      throw new Error('没有种子了');
    }
    seed.num--;
    this.site.logger.info(`[PluginJfarm] [土地${landId}] 将播种 ${seed.name}`);
    let $ = await this.fetchApi({ do: 'plantseed', landId, ex: { seed: seed.id } });
    this.health--;
  }

  //收获
  async doLandHarvest(landId) {
    let rep = await this.site.axiosInst.get(`/plugin.php?id=jnfarm&do=harvest&jfid=${landId}&formhash=${this.formHash}`);
    let land = _.find(this.lands, (v) => v.id == landId);
    this.site.logger.info(`[PluginJfarm] [土地${landId}] 收获成功 ${land == null ? '' : `数量 ${land.num}`}`);
  }

  // 获取成长信息
  async fetchLandFarm(landId) {
    let rep = await this.site.axiosInst.get(`/plugin.php?id=jnfarm&do=normal&ac=thisfarm&jfid=${landId}&fhash=${this.formHash}&inajax=1&ajaxtarget=try`);
    let $ = cheerio.load(rep.data);
    let info = new LandInfo();
    $('div').each((i, v) => {
      let $div = $(v);
      if ($div.children('div').length > 0) return;
      let txt = $div.text().trim();
      if (txt.indexOf('清除') >= 0) {
      } else if (txt.indexOf('数量') >= 0) {
        info.num = parseInt(/(\d+)\//.exec(txt)[0]);
      } else if (txt.indexOf('成熟') >= 0) {
        let dateT = txt.substring(0, txt.length - 2);
        info.endTime = new Date(dateT);
      } else if (txt == '收获') {
        info.endTime = new Date();
      }
    });
    return info;
  }
  // 卖出作物
  async doSell() {
    await this.fetchStore();
    // /plugin.php?id=jnfarm&do=store&submit=true&timestamp=1616389991&formhash=c6876729&storesubmit=yes&prod%5B1%5D=1&prodqty%5B1%5D=1
    let ex = {
      do: 'store',
      timestamp: Math.ceil(new Date().getTime() / 1000),
      formhash: this.formHash,
      submit: 'true',
      storesubmit: 'yes',
    };
    let hasProd = false;
    _.forEach(this.store, (v, i) => {
      if (v.type == PluginJfarm.TYPE_PROD) {
        ex[`prod[${v.id}]`] = 1;
        ex[`prodqty[${v.id}]`] = v.num;
        this.site.logger.info(`将卖出 ${v.name}=${v.num}`);
        hasProd = true;
      }
    });
    if (!hasProd) return; //没有作物就跳过
    let q = qs.stringify(ex);
    let rep = await this.site.axiosInst.get(`/plugin.php?id=jnfarm&${q}`);
    this.site.logger.info(JSON.parse(rep.data).final);
    await this.fetchStore();
  }
  // 任务步骤
  taskSteps = [];

  async autoTask() {
    // 构建任务
    //刷新土地
    await this.fetchIndex();
    await this.fetchStore();
    this.taskSteps = [];
    let doSeed = async (landId) => {
      if (this.getSeed() == null) {
        //没有种子，则进行购买
        await this.doSell();
        await this.doBuySeed();
      }
      await this.doLandSeed(landId);
    };
    let needRefresh = true;
    let ps = this.lands.map(async (land) => {
      if (land.kind == LandInfo.EMPTY) {
        //播种
        // this.site.logger.info(`[PluginJfarm] [土地${land.id}] 需要播种`);
        this.taskSteps.push({
          action: () => {
            return doSeed(land.id);
          },
        });
        // 播种完需要刷新
        this.taskSteps.push({
          eta: new Date().getTime() + 5000,
          action: (qt) => {
            qt.destroy();
            return Promise.resolve();
          },
        });
      } else if (land.kind == LandInfo.FARMING) {
        if (land.num == null) {
          let info = await this.fetchLandFarm(land.id);
          land.num = info.num;
          land.endTime = info.endTime;
          this.site.logger.info(`[PluginJfarm] [土地${land.id}] 数量=${land.num} 将在${info.endTime}成熟`);
        }
        this.taskSteps.push({
          eta: land.endTime.getTime() + 3000,
          action: async (qt) => {
            //收获
            await this.doLandHarvest(land.id);
            qt.destroy();
            // await sleep(3000);
            // //再播种
            // await doSeed(land.id);
          },
        });
      }
    });
    await Promise.all(ps);
    // 等待task.
    await this.doSteps(this.taskSteps);
  }

  async doSteps(steps) {
    let qt = new QueueTask(steps);
    await qt.start();
  }

  async test() {
    setInterval(() => {
      // this.site.logger.info('keep alive');
      axios
        .post(
          // `http://127.0.0.1:9010/api/wgw/alive/do`
          `https://wgw.suamo.art/api/wgw/alive/do`,
          {
            Name: 'ppd-node',
          },
        )
        .catch((e) => {
          this.site.logger.error(e);
        });
    }, 2 * 60000);
    await this.fetchIndex();
    // await this.fetchStore();
    // await this.fetchLandFarm(this.lands[0].id);
    // await this.doLandHarvest(this.lands[0].id);
    // await this.doLandSeed(this.lands[0].id);
    // await this.doSell();
    // return;
    while (true) {
      await this.autoTask();
      await sleep(5000);
    }
  }
}

if (require.main === module) {
  let cnf;
  let jfarm: PluginJfarm;
  let luckyPost: PluginLuckypost;

  class A extends BaseAction {
    async init(): Promise<any> {
      cnf = getConfig();
      this.cnf = cnf;
      // cnf.useGot = true;
      this.site = new SiteCrawlerDiscuz(cnf);
      this.spam = new SpamNormal(cnf, this.site);
      jfarm = new PluginJfarm(this.site);
      luckyPost = new PluginLuckypost(this.site as any);
      this.otherActions = [
        { name: '农场', value: 'jfarm' },
        { name: '发帖际遇', value: 'luckypost' },
      ];
    }

    async onOtherAction(act: string) {
      if (act == 'jfarm') {
        return await jfarm.test();
      } else if (act == 'luckypost') {
        return await luckyPost.showInfo();
      }
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
            // 宝箱签到
            await this.site.axiosInst.get('/plugin.php?id=zgxsh_chest:index_if&op=sign&infloat=yes&handlekey=TC&inajax=1&ajaxtarget=fwin_content_TC');
            //恢复每日限额，目前保证不上榜
            this.site.config.limit.reply = ReplyLimitNum;
            return true;
          }),
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
          this.spam.doWithLimit(
            'reply',
            () =>
              //TODO 确保自己不上榜
              this.spam.shuiCagegory('9', {
                checkPost: (p: Post) => {
                  return p.replyNum > cnf.replyPageSize * 2 && moment(p.createTime).add(7, 'd').isAfter(); //7天内的主题
                },
                onReply: async (p: Post) => {
                  let pnMax = Math.ceil(p.replyNum / cnf.replyPageSize) - 2;
                  let pn = 2;
                  if (pnMax > pn) pn = _.random(pn, pnMax, false);
                  let re = await this.spam.gerRandomReply(p, pn); //TODO 重复回复
                  return re == null ? null : re.body;
                },
                maxPage: 5,
              }),
            async () => {
              //TODO 一次标记
              //检查任务
              this.task(26, false);
              let tops = await this.fetchTopPoster();
              let me = _.find(tops, (v) => v.uid == cnf.myUserId);
              if (me == null) {
                this.site.config.limit.reply = _.last(tops).num - 3;
                this.site.logger.info(`更新reply ${this.site.config.limit.reply}`);
              }
            },
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
    // 获取每日之星
    async fetchTopPoster() {
      let $ = cheerio.load((await this.site.axiosInst.get('/forum.php')).data);
      let tops = [];
      $('#dx-ranks-bd li').each((i, dom) => {
        let $a = $(dom).find('a.xi2');
        let topa = {
          uid: _.last($a.attr('id').split('-')),
          num: getInt($a.text()),
        };
        tops.push(topa);
      });
      return tops;
    }
  }

  let siteA = new A();
  // siteA.start('jfarm');
  // siteA.start('shui');
  // siteA.start('luckypost');
  siteA.start();
  // siteA.prepare().then(() => {
  //   siteA.fetchTopPoster();
  // });
}
