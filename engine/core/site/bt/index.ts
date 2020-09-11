import { IPostParseConfig, SiteCrawler } from '../normal';
import { Post } from '../../post';
import { initConfig } from '../../index';
import * as inquirer from 'inquirer';
import { MainConfig, SiteConfig } from '../../config';
import _ = require('lodash');
import { BtSubItem, BtTorrent, IFileHashPiece } from './model';
import bytes = require('bytes');
import getSiteConfigs from './sitecnf';
import { BtSiteBaseConfig } from './sitecnf/base';
import cheerio = require('cheerio');
import ESClient from '../../es';
import { Progress, runSafe } from '../../utils';
import ResourceTask from '../../utils/resourceTask';
import WgwClient from '../../utils/wgw';
import parseTorrent = require('parse-torrent');
import fs = require('fs');

import cookies from '../../../sites/cookie';
import * as path from 'path';
import * as yargs from 'yargs';

export class BtCrawler extends SiteCrawler {
  btCnf: BtSiteBaseConfig;
  static minFileSize = 100 * 1024 * 1024;
  passkey: string;
  downloadThread: number;

  constructor(cnf: BtSiteBaseConfig) {
    let scnf = new SiteConfig(cnf.key);
    _.merge(scnf, cnf);
    scnf.name = cnf.key;
    scnf.pageResultSave = true;
    scnf.proxys = [{ type: 'sock5', host: '127.0.0.1', port: 8023 }];
    super(scnf);
    this.btCnf = cnf;
    this.passkey = _.get(cookies[cnf.host], 'passkey');
    this.downloadThread = 3;
  }

  async init(): Promise<void> {
    await super.init();
    await this.ensureTempDir();
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
    return this.config.fullUrl(`/details.php?id=${pid}`);
    // return this.config.fullUrl(`//viewfilelist.php?id=${pid}`);
  }

  parsePage(
    $: CheerioStatic,
    cateId?,
    html?: string,
  ): Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }> {
    let $form = $('#form_torrent');
    // 获取页数
    let $pages = $('.torrents').siblings('p').find('a');
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
      let $tdName = $tname.find('td.embedded').eq(0);
      let $a = $tname.find('a').filter((j, x) => _.get(x.attribs, 'href').indexOf('details.php') >= 0);
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
      torrent._fsizeH = sizeT;
      torrent.fsize = bytes(sizeT);
      torrent.upNum = parseInt($tds.eq(5).text().trim());
      torrent._isTop = $tname.find('.sticky').length > 0;
      torrent._isFree = $tname.find('.pro_free').length > 0 || $tname.find('.pro_free2up').length > 0;
      posts.push(torrent);
    });
    posts.sort((a, b) => b.tid - a.tid); //从大到小
    return Promise.resolve({ $: undefined, pageMax, posts });
  }

  async fetchSubItems(torr: BtTorrent): Promise<Array<BtSubItem>> {
    let rep = await this.axiosInst.get(`/viewfilelist.php?id=${torr.tid}`);
    let $ = cheerio.load(rep.data);
    let flist = [];

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
      if (sb.fsize > BtCrawler.minFileSize) {
        flist.push(sb);
      }
    });
    return flist;
  }

  // async startFetchFileInfos(cates) {
  //   let b = new BtTorrent();
  //   for (let cate of cates) {
  //     await runSafe(
  //       async () => {
  //         let scrollSearch = ESClient.inst().helpers.scrollSearch({
  //           index: b.indexName(),
  //           scroll: '10m',
  //           body: {
  //             size: 20,
  //             sort: [
  //               {
  //                 createTime: {
  //                   order: 'desc',
  //                 },
  //               },
  //             ],
  //             query: {
  //               bool: {
  //                 must: {
  //                   term: {
  //                     categoryId: cate.id,
  //                   },
  //                 },
  //                 must_not: {
  //                   exists: {
  //                     field: 'hasFiles',
  //                   },
  //                 },
  //               },
  //             },
  //           },
  //         });
  //         let pg = new Progress();
  //         for await (const result of scrollSearch) {
  //           if (pg.total == 0) pg.total = result.body.hits.total.value;
  //           for (let bt of result.body.hits.hits) {
  //             bt = new BtTorrent(bt._source);
  //             let flist = await this.fetchSubItems(bt);
  //             if (flist.length > 0) {
  //               let bodys = flist.flatMap((x) => [{ index: { _index: x.indexName() }, _id: x.uniqId() }, x.getBody()]);
  //               let createRep = await ESClient.inst().bulk({ body: bodys });
  //               ESClient.checkRep(createRep);
  //             }
  //             bt.hasFiles = true;
  //             await bt.save();
  //             pg.incr();
  //             this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 添加：${flist.length} ${pg.fmt()}`);
  //           }
  //         }
  //       },
  //       async (e) => {
  //         this.logger.error(e);
  //         return false;
  //       },
  //     );
  //   }
  // }
  // 获取种子文件列表，目前只收集>100M的文件
  async startFetchFileInfos2(cates) {
    let b = new BtTorrent({ site: this.btCnf.key });
    let pg = new Progress();

    async function* resIter() {
      for (let cate of cates) {
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
                must: [
                  { term: { site: b.site } },
                  {
                    term: {
                      categoryId: cate.id,
                    },
                  },
                ],
                must_not: [
                  {
                    exists: {
                      field: 'hasBt',
                    },
                  },
                  {
                    exists: {
                      field: 'deleteAt',
                    },
                  },
                ],
              },
            },
          },
        });
        for await (const result of scrollSearch) {
          if (pg.total == 0) pg.total = result.body.hits.total.value;
          let bts = [];
          for (let bt of result.body.hits.hits) {
            let btv = new BtTorrent(bt._source);
            // bts.push(bt);
            yield btv;
          }
          // yield bts;
        }
      }
    }

    let task = new ResourceTask({
      // create: () => ito.next() as any,
      createIter: resIter(),
      max: this.downloadThread,
      onDo: async (bt: BtTorrent) => {
        await runSafe(
          async () => {
            await this.downloadBtFile(bt.tid);
            // let flist = await this.fetchSubItems(bt);
            // if (flist.length > 0) {
            //   let bodys = flist.flatMap((x) => [
            //     {
            //       index: {
            //         _index: x.indexName(),
            //         _id: x.uniqId(),
            //       },
            //     },
            //     x.getBody(),
            //   ]);
            //   let createRep = await ESClient.inst().bulk({ body: bodys });
            //   ESClient.checkRep(createRep);
            // }
            // bt.hasFiles = true;
            // await bt.save();
            // this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 添加：${flist.length} ${pg.fmt()}`);
            this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} ${pg.fmt()}`);
            pg.incr();
          },
          async (e) => {
            this.logger.error(e);
            return false;
          },
        );
      },
    });
    task.start();
    await task.wait();
    this.logger.info('startFetchFileInfos done');
  }

  async parsePost(post, $, pcf?: IPostParseConfig): Promise<Post> {
    let bt = post as BtTorrent;
    let $hash = $('#showfl').closest('tr').find('td').eq(1);
    let hash = $hash.text().split(':')[1].trim();
    bt.hash = hash;
    return bt as any;
  }

  async sendPost(cp: Post, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }

  async sendReply(post: Post, text: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  // 新的free种子
  async watchFree() {
    await this.cache.load();
    let oldCache = _.defaultTo(this.cache.other.freeMap, {});
    let notifyHtml = ``;
    let send = false;
    for (let cate of this.btCnf.torrentPages) {
      //第一页
      await this.loopCategory(cate, async (posts) => {
        // @ts-ignore
        let bts = posts as Array<BtTorrent>;
        let oldFreeList = _.defaultTo(oldCache[cate], []);
        let nextList = _.filter(bts, (b) => b._isFree || b._isTop);
        let newFreeList = _.filter(nextList, (b) => oldFreeList.indexOf(b.tid) < 0);
        this.logger.info('找到新的', newFreeList.length);
        notifyHtml += `<div><h3>${cate}</h3></div>`;
        newFreeList.forEach((v) => {
          send = true;
          notifyHtml += `<div>
<span>[${v.createTime.toLocaleString()}]</span>
${v._isTop ? `<span style="color: #7189d9">[Top]</span>` : ''}
${v._isFree ? `<span style="color: #0034ce">[Free]</span>` : ''}
${v.title} [${v.title2}][${v._fsizeH}]<a href="${this.getPostUrl(v.tid)}" target="_blank">[link]</a>
</div>`;
        });
        notifyHtml += '<hr>';
        oldCache[cate] = _.map(nextList, (v) => v.tid);
        return false;
      });
    }
    this.cache.other.freeMap = oldCache;
    await this.cache.save();
    if (send) WgwClient.inst().sendMail(`[BT] ${this.btCnf.key} Free`, notifyHtml);
    return notifyHtml;
  }

  async searchWeb(q: { hash?: string } = {}) {
    if (q.hash) {
      //搜索hash
    }
  }

  async downloadBtFile(tid: number) {
    let furl = this.config.fullUrl(`/download.php?id=${tid}&passkey=${this.passkey}&https=1`);
    let dFile = await this.download(furl, { desFile: `${this.btCnf.key}-${tid}.torrent` }).catch(async (e) => {
      if (e.response && e.response.status == 404) {
        this.logger.error('未找到', furl);
        //删除种子信息
        let bt = new BtTorrent();
        bt.site = this.btCnf.key;
        bt.tid = tid;
        if (await bt.loadById()) {
          await bt.update({ deleteAt: new Date() });
          let rep2 = await ESClient.inst().deleteByQuery({
            index: BtSubItem.indexName,
            body: {
              query: {
                bool: {
                  must: [{ term: { site: bt.site } }, { term: { tid: bt.tid } }],
                },
              },
            },
          });
          // debugger;
        }
      } else {
        throw e;
      }
    });
    if (dFile == null) {
      return;
    }
    await this.fixBtData(tid, dFile as string).catch((e) => {
      if (e.message.indexOf('Invalid data: Missing delimiter') >= 0) {
        //种子文件有问题重新下载
        this.logger.error('种子文件错误', dFile);
        fs.unlinkSync(dFile as string);
      }
      throw e;
      // debugger;
    });
    return dFile;
  }

  // 修复数据
  async fixBtData(tid: number, btFile: string) {
    let bt = new BtTorrent();
    bt.site = this.btCnf.key;
    bt.tid = tid;
    if (await bt.loadById()) {
      if (!bt.hasBt) {
        let tInfo = parseTorrent(fs.readFileSync(btFile));
        bt.hash = tInfo.infoHash;
        //删除文件
        let delRep = await ESClient.inst().delete_by_query({
          index: new BtSubItem().indexName(),
          body: {
            query: {
              bool: {
                must: [{ term: { site: bt.site } }, { term: { tid: bt.tid } }],
              },
            },
          },
        });
        if (_.size(tInfo.files) > 0) {
          //多文件
          let bodys = tInfo.files.flatMap((x) => {
            if (x.length < BtCrawler.minFileSize) return [];
            let sub = new BtSubItem();
            sub.tid = bt.tid;
            sub.site = bt.site;
            // sub.fname = path.posix.normalize(x.path);
            sub.fname = path.relative(tInfo.name, x.path).replace(/\\/g, '/');
            if (_.size(sub.fname) == 0) {
              sub.fname = x.path.replace(/\\/g, '/');
            }
            sub.fsize = bytes(bytes(x.length));
            sub.fsizeExact = x.length;

            let beginPieceIdx = Math.ceil(x.offset / tInfo.pieceLength);
            let fileOffset = beginPieceIdx * tInfo.pieceLength - x.offset;
            let fMaxPieces = Math.ceil(x.length / tInfo.pieceLength);
            let iOff = Math.ceil(fMaxPieces / 2);
            if (fMaxPieces < 10) {
              iOff = 0;
            }
            sub.hashs = {
              offset: fileOffset,
              pieceLength: tInfo.pieceLength,
              pieces: [],
            };
            for (let i = 0; i < 3 && i < fMaxPieces; i++) {
              //保留3个piece
              let idx = beginPieceIdx + iOff + i;
              let p: IFileHashPiece = {
                i: iOff + i,
                hash: tInfo.pieces[idx],
              };
              sub.hashs.pieces.push(p);
            }
            return [{ index: { _index: sub.indexName(), _id: sub.uniqId() } }, sub.getBody()];
          });
          if (bodys.length > 0) {
            let createRep = await ESClient.inst().bulk({ body: bodys });
            ESClient.checkRep(createRep);
          }
        } else {
          debugger;
        }
        bt.hasFiles = true;

        bt.hasBt = true;
        await bt.save();
      }
    }
  }
}

// export function mksize(bytes)
// {
//   if (bytes < 1000 * 1024)
//     return number_format($bytes / 1024, 2) . " KB";
//   elseif ($bytes < 1000 * 1048576)
//   return number_format($bytes / 1048576, 2) . " MB";
//   elseif ($bytes < 1000 * 1073741824)
//   return number_format($bytes / 1073741824, 2) . " GB";
//   elseif ($bytes < 1000 * 1099511627776)
//   return number_format($bytes / 1099511627776, 3) . " TB";
// else
//   return number_format($bytes / 1125899906842624, 3) . " PB";
// }

async function fix1(site: BtCrawler) {
  let rep = await ESClient.inst().search({
    index: BtSubItem.indexName,
    size: 5000,
    body: {
      query: {
        bool: {
          must: [
            {
              term: {
                fname: '',
              },
            },
            { term: { site: site.btCnf.key } },
          ],
        },
      },
    },
  });
  site.logger.info('共', rep.body.hits.total.value);
  let fixed = {};
  for (let b of rep.body.hits.hits) {
    let tid = b._source.tid;
    if (fixed[tid]) continue;
    let bt = new BtTorrent();
    bt.site = b._source.site;
    bt.tid = tid;
    site.logger.info('fix', bt.tid);
    await bt.update({ hasBt: false });
    await site.downloadBtFile(tid);
    fixed[tid] = 1;
  }
}

async function main() {
  await initConfig();
  let siteChoices = getSiteConfigs().map((v) => {
    return {
      name: v.key,
      value: v,
    };
  });
  let ua;
  let argv = yargs.argv;
  if (argv.site) {
    /**
     * --site=nicept --act=list
     */
    ua = {
      site: _.find(siteChoices, (v) => v.name == argv.site).value,
      act: argv.act,
    };
  } else {
    ua = await inquirer.prompt([
      {
        name: 'site',
        type: 'rawlist',
        message: '选择站点',
        choices: siteChoices,
      },
      {
        name: 'act',
        type: 'rawlist',
        message: '操作',
        choices: [
          { name: '爬取列表', value: 'list' },
          { name: '爬取种子', value: 'file' },
        ],
      },
    ]);
  }
  let sc = ua.site;
  let site = new BtCrawler(sc);
  await site.init();
  let cates = sc.torrentPages.map((v) => ({ id: v, name: v }));
  switch (ua.act) {
    case 'list':
      await site.startFindLinks(cates);
      break;
    case 'file':
      let { doCates } = argv;
      let doChoices = [{ name: 'all', value: cates }, ...cates.map((v) => ({ name: v.id, value: [v] }))];
      if (doCates) {
        doCates = _.find(doChoices, (v) => v.name == doCates).value;
      } else {
        let r = await inquirer.prompt({
          name: 'doCates',
          type: 'rawlist',
          message: '爬取目录',
          choices: doChoices,
        });
        doCates = r.doCates;
      }
      await site.startFetchFileInfos2(doCates);
      break;
    default:
      MainConfig.logger().error('不支持的act');
      break;
  }
  //
  // await site.startFetchFileInfos(cates);
}

if (require.main === module) {
  main();
}
