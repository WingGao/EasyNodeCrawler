import getSiteConfigs from './sitecnf';
import _ = require('lodash');
import { BtSiteBaseConfig } from './sitecnf/base';
import { BtCrawler } from './index';
import { BtSubItem, BtTorrent } from './model';
import ESClient from '../../es';
import { Progress } from '../../utils';
import ResourceTask from '../../utils/resourceTask';
import parseTorrent = require('parse-torrent');
import fs = require('fs');
import bytes = require('bytes');
import { Logger } from 'log4js';
import { MainConfig } from '../../config';
import stringSimilarity = require('string-similarity');
import { initConfig } from '../../index';
/**
 * 将所有BT站点聚合
 */
export class BtMain {
  siteConfigs: { [key: string]: BtSiteBaseConfig } = {};
  sites: { [key: string]: BtCrawler } = {};
  logger: Logger;
  downloadThread = 3;
  constructor() {}
  async init() {
    this.logger = MainConfig.logger();
    this.siteConfigs = _.keyBy(getSiteConfigs(), (v) => v.key);
    for (let scnf of getSiteConfigs()) {
      this.siteConfigs[scnf.key] = scnf;
      let site = new BtCrawler(scnf);
      this.sites[scnf.key] = site;
      await site.init();
    }
  }

  /**
   * 找相同文件的种子
   * @param q
   */
  async findSimilarTorrent(q: { btPath?: string }) {
    let subMod = new BtSubItem();
    let tInfo;
    if (q.btPath) {
      tInfo = parseTorrent(fs.readFileSync(q.btPath));
    }
    let matchedBtMap = {};
    for (let f of tInfo.files) {
      if (f.length < BtCrawler.minFileSize) continue;
      let fSize = bytes(f.length); // 先和网页数值对齐
      fSize = bytes(fSize); //再转换
      // console.log(f.name, fSize);
      // continue;
      this.logger.info('比对文件', f.name);
      // if (f.name.indexOf('IPX-098.mp4') >= 0) {
      let reDo = false;
      do {
        reDo = false;
        let res = await ESClient.inst().search({
          index: subMod.indexName(),
          size: 10000,
          body: {
            query: {
              term: {
                fsize: fSize,
              },
            },
          },
        });
        let subList = _.map(res.body.hits.hits, (v) => {
          let s = new BtSubItem(v._source);
          // @ts-ignore
          // s._d = levenshtein.get(f.path, s.fname);
          return s;
        });
        subList = _.sortBy(subList, (v: any) => {
          v._d = stringSimilarity.compareTwoStrings(f.path.toLowerCase(), v.fname.toLowerCase());
          return -v._d;
        });
        if (subList.length > 200) {
          subList = _.filter(subList, (v) => (v as any)._d > 0.15);
        }
        this.logger.info('相似文件', subList.length);
        let toFixTids = {};
        for (let sub of subList) {
          let bt1 = new BtTorrent({ tid: sub.tid, site: sub.site });
          if (sub.fsizeExact == null) {
            toFixTids[bt1.uniqId()] = bt1;
            // 查询具体结果
          } else {
            if (sub.fsizeExact == f.length) {
              //大概率是同文件
              let mat = _.defaultTo(matchedBtMap[bt1.uniqId()], 0);
              mat += sub.fsizeExact;
              matchedBtMap[bt1.uniqId()] = mat;
            }
          }
        }
        if (_.size(toFixTids) > 0) {
          reDo = true;
          let bts = _.values(toFixTids);
          let pg = new Progress(bts.length);
          let mp = new ResourceTask({
            resourceArr: bts,
            max: this.downloadThread,
            retry: true,
            onDo: async (b: BtTorrent) => {
              this.logger.info('下载文件', pg.fmt());
              let site = this.sites[b.site];
              await site.downloadBtFile(b.tid);
              pg.incr();
            },
          });
          mp.start();
          await mp.wait();
        }
      } while (reDo);
      // }
    }

    this.logger.info('完成', tInfo.name);
    let items = await Promise.all(
      _.map(matchedBtMap, async (v, k) => {
        let bt = new BtTorrent();
        await bt.loadById(k);
        return {
          tid: k,
          score: v,
          scoreH: bytes(v),
          sizeRate: v / bt.fsize,
          bt,
        };
      }),
    );
    items = _.filter(items, (v) => v.bt.hash != tInfo.infoHash);
    items = _.sortBy(items, (v) => -v.sizeRate);
    return {
      hash: tInfo.infoHash,
      items,
    };
  }
}

let BtMainInst = new BtMain();
export default BtMainInst;

if (require.main === module) {
  (async () => {
    await initConfig();
    await BtMainInst.init();
    let r = await BtMainInst.findSimilarTorrent({ btPath: 'D:\\tmp\\ec667120e2636400.torrent' });
    return;
  })();
}
