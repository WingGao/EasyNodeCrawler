import { IPostParseConfig, SiteCrawler } from '../normal';
import { Post } from '../../post';
import { initConfig } from '../../index';
import * as inquirer from 'inquirer';
import { SiteConfig } from '../../config';
import _ = require('lodash');
import { BtSubItem, BtTorrent } from './model';
import bytes = require('bytes');
import getSiteConfigs from './sitecnf';
import { BtSiteBaseConfig } from './sitecnf/base';
import cheerio = require('cheerio');
import ESClient from '../../es';
import { Progress, runSafe } from '../../utils';

export class BtCrawler extends SiteCrawler {
  btCnf: BtSiteBaseConfig;
  constructor(cnf: BtSiteBaseConfig) {
    let scnf = new SiteConfig(cnf.key);
    _.merge(scnf, cnf);
    scnf.name = cnf.key;
    scnf.pageResultSave = true;
    scnf.proxys = [{ type: 'sock5', host: '127.0.0.1', port: 8023 }];
    super(scnf);
    this.btCnf = cnf;
  }
  async checkCookie(): Promise<any> {
    let rep = await this.axiosInst.get('/usercp.php');
    return rep.data.indexOf(this.btCnf.myUserId) > 0;
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page: number = 1, ext?: string): string {
    return this.config.fullUrl(`${cateId}?&page=${page - 1}${_.defaultTo(ext, '')}`);
  }

  getPostUrl(pid, page?: number): string {
    // return this.config.fullUrl(`/details.php?id=${pid}`);
    return this.config.fullUrl(`//viewfilelist.php?id=${pid}`);
  }

  parsePage(
    $: CheerioStatic,
    cateId?,
    html?: string,
  ): Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }> {
    let $form = $('#form_torrent');
    // 获取页数
    let $pages = $form.find('>p a');
    let pageMax = 0;
    $pages.each((i, v) => {
      let page = parseInt(/page=(\d+)/.exec(v.attribs.href)[1]);
      if (!isNaN(page)) {
        pageMax = Math.max(pageMax, page);
      }
    });
    pageMax++;
    let posts = [];
    $('.torrents > tbody > tr').each((i, v) => {
      if (i == 0) return;
      let $tr = $(v);
      let torrent = new BtTorrent();
      torrent.site = this.btCnf.key;
      let $tds = $tr.find('>td');
      let $tname = $tr.find('.torrentname');
      let $tdName = $tname.find('td').eq(1);
      let $a = $tdName.find('>a');
      torrent.tid = parseInt(/id=(\d+)/.exec($a.attr('href'))[1]);
      torrent.title = $a.text().trim();
      $a.remove();
      let br = $tdName.find('br').get(0);
      if (br != null) {
        torrent.title2 = $(br.nextSibling).text().trim();
      }
      let ctimeT = $tds.eq(3).find('span').attr('title');
      torrent.createTime = new Date(ctimeT);
      let sizeT = $tds.eq(4).text().trim();
      torrent.fsize = bytes(sizeT);
      torrent.upNum = parseInt($tds.eq(5).text().trim());
      torrent._isTop = $tname.find('.sticky').length > 0;
      posts.push(torrent);
    });
    posts.sort((a, b) => b.tid - a.tid); //从大到小
    return Promise.resolve({ $: undefined, pageMax, posts });
  }

  async fetchSubItems(torr: BtTorrent): Promise<Array<BtSubItem>> {
    let rep = await this.axiosInst.get(`/viewfilelist.php?id=${torr.tid}`);
    let $ = cheerio.load(rep.data);
    let flist = [];
    let minAddSize = 100 * 1024 * 1024;
    let x = bytes(minAddSize);
    $('tr').each((i, tr) => {
      if (i == 0) return;
      let $tr = $(tr);
      let $tds = $tr.find('td');
      let sb = new BtSubItem();
      sb.site = torr.site;
      sb.tid = torr.tid;
      sb.fname = $tds.eq(0).text().trim();
      sb._fsizeH = $tds.eq(1).text().trim();
      sb.fsize = bytes(sb._fsizeH);
      // 只添加>100M的
      if (sb.fsize > minAddSize) {
        flist.push(sb);
      }
    });
    return flist;
  }

  async startFetchFileInfos(cates) {
    let b = new BtTorrent();
    for (let cate of cates) {
      await runSafe(
        async () => {
          let scrollSearch = ESClient.inst().helpers.scrollSearch({
            index: b.indexName(),
            scroll: '10m',
            body: {
              size: 20,
              sort: [
                {
                  createTime: {
                    order: 'desc',
                  },
                },
              ],
              query: {
                bool: {
                  must: {
                    term: {
                      categoryId: cate.id,
                    },
                  },
                  must_not: {
                    exists: {
                      field: 'hasFiles',
                    },
                  },
                },
              },
            },
          });
          let pg = new Progress();
          for await (const result of scrollSearch) {
            if (pg.total == 0) pg.total = result.body.hits.total.value;
            for (let bt of result.body.hits.hits) {
              bt = new BtTorrent(bt._source);
              let flist = await this.fetchSubItems(bt);
              if (flist.length > 0) {
                let bodys = flist.flatMap((x) => [{ index: { _index: x.indexName() }, _id: x.uniqId() }, x.getBody()]);
                let createRep = await ESClient.inst().bulk({ body: bodys });
                ESClient.checkRep(createRep);
              }
              bt.hasFiles = true;
              await bt.save();
              pg.incr();
              this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 添加：${flist.length} ${pg.fmt()}`);
            }
          }
        },
        async (e) => {
          this.logger.error(e);
          return false;
        },
      );
    }
  }

  async parsePost(post: Post, $, pcf?: IPostParseConfig): Promise<Post> {
    return Promise.resolve(undefined);
  }

  async sendPost(cp: Post, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }

  async sendReply(post: Post, text: string): Promise<any> {
    return Promise.resolve(undefined);
  }
}

async function main() {
  await initConfig();
  let ua = await inquirer.prompt({
    name: 'site',
    type: 'rawlist',
    message: '选择站点',
    choices: getSiteConfigs().map((v) => {
      return {
        name: v.key,
        value: v,
      };
    }),
  });
  let sc = ua.site;
  let site = new BtCrawler(sc);
  await site.init();
  let cates = sc.torrentPages.map((v) => ({ id: v, name: v }));
  // await site.startFindLinks(sc.torrentPages.map((v) => ({ id: v, name: v })));
  // await site.startFetchFileInfos(cates);
  await site.startFetchFileInfos([{ id: '/adult.php', name: '/adult.php' }]);
}
if (require.main === module) {
  main();
}
