import { SiteCrawlerDiscuz } from './index';
import { IPostParseConfig, SiteCrawler } from '../normal';
import { Post } from '../../post';
import cheerio = require('cheerio');
import { getInt } from '../../utils';

export class PluginLuckypost {
  site: SiteCrawlerDiscuz;

  constructor(site: SiteCrawlerDiscuz) {
    this.site = site;
  }

  get logger() {
    return this.site.logger;
  }

  async fetchList() {
    let urlPre = `/plugin.php?id=luckypost&op=my&page=`;
    let pageMax = 1;
    let allCoin = 0;
    let postNum = 0;
    let newlastTid;
    for (let pageIdx = 1; pageIdx <= pageMax; pageIdx++) {
      this.logger.info(`获取第${pageIdx}`);
      let rep = await this.site.axiosInst.get(urlPre + pageIdx);
      let $ = cheerio.load(rep.data);
      let $page = $('#pgt .pg label span');
      pageMax = getInt($page.text());
      // 分析情况
      let tbodyList = $('#threadlist tbody');
      tbodyList.each((i, dom) => {
        let $tbody = $(dom);
        let tid = $tbody.attr('id');
        if (tid == null || !/^\d+$/.test(tid.trim())) {
          return;
        }
        if (newlastTid == null) newlastTid = tid;
        let $th = $tbody.find('> tr > th');
        let coinT = $th.text();
        let g = /\( 河洛币 (-?\d+) 枚 \)/.exec(coinT);
        let coin = parseInt(g[1]);
        allCoin += coin;
        postNum++;
        // this.logger.info($tbody.text());
      });
      // debugger;
      // break;
    }
    this.logger.info(`帖子=${postNum}, 合计=${allCoin}, 最新Tid=${newlastTid}`);
  }

  async showInfo() {
    await this.fetchList();
  }
}
