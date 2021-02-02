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
import { Progress, runSafe, sleep } from '../../utils';
import ResourceTask from '../../utils/resourceTask';
import WgwClient from '../../utils/wgw';
import parseTorrent = require('parse-torrent');
import fs = require('fs');
import check = require('check-types');
import cookies from '../../../sites/cookie';
import * as path from 'path';
import * as yargs from 'yargs';
import moment = require('moment');
import qs = require('qs');

//NexusPhp
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
    this.downloadThread = this.btCnf.downloadThread;
  }

  async init(): Promise<void> {
    await super.init();
    await this.ensureTempDir();
  }

  parseCheckCookie(data) {
    let ok = data.indexOf(this.btCnf.myUserId) > 0;
    if (ok) {
      let $ = cheerio.load(data);
      let infoTxt = $('#info_block').text();
      this.isCheckIn = /簽到已得|签到已得/.test(infoTxt);
    } else {
      this.logger.error('未登录');
      throw Error('未登录');
    }
    return ok;
  }

  async checkCookie(): Promise<any> {
    // let ip = this.checkIP();
    if (this.btCnf.checkCookie) return await this.btCnf.checkCookie(this);
    let rep = await this.axiosInst.get('/usercp.php');
    return this.parseCheckCookie(rep.data);
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page: number = 1, ext?: string): string {
    return this.config.fullUrl(`${cateId}${cateId.indexOf('?') >= 0 ? '' : '?'}&page=${page - 1}${_.defaultTo(ext, '')}`);
  }

  getPostUrl(pid, page?: number): string {
    return this.config.fullUrl(`/details.php?id=${pid}`);
    // return this.config.fullUrl(`//viewfilelist.php?id=${pid}`);
  }

  parsePage($: CheerioStatic, cateId?, html?: string): Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }> {
    if (this.btCnf.parsePage != null) {
      return this.btCnf.parsePage(this, $, cateId, html);
    }
    return this.parsePageNormal($, cateId, html);
  }
  parsePageNumNormal($: CheerioStatic) {
    // 获取页数
    let pageMax = 0;
    if (this.btCnf.parsePageNum) {
      pageMax = this.btCnf.parsePageNum(this, $);
    } else {
      let $pages = $('.torrents').siblings('p').find('a');
      $pages.each((i, v) => {
        let pageu = v.attribs.href;
        if (_.size(pageu) == 0) return;
        pageu = pageu.split('?')[1];
        let para = qs.parse(pageu) as any;
        if (para.page == null) return;
        let page;
        if (!_.isString(para.page)) page = parseInt(_.last(para.page));
        else page = parseInt(para.page);
        // let g = /page=(\d+)/.exec(v.attribs.href);
        // if (g == null) return;
        // let page = parseInt(g[1]);
        if (!isNaN(page)) {
          pageMax = Math.max(pageMax, page);
        }
      });
      pageMax++;
    }
    return pageMax;
  }
  // 通用解析pagelist
  parsePageNormal($: CheerioStatic, cateId?, html?: string): Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }> {
    let $form = $('#form_torrent');
    let pageMax = this.parsePageNumNormal($);
    let posts = [];
    $('.torrents > tbody > tr').each((i, v) => {
      if (i == 0) return;
      let $tr = $(v);
      let torrent = new BtTorrent();
      torrent.site = this.btCnf.key;
      torrent.categoryId = cateId;
      if (this.btCnf.parsePageTr) this.btCnf.parsePageTr(this, $, $tr, torrent);
      else this.parsePageTr($, $tr, torrent);
      posts.push(torrent);
    });
    posts.sort((a, b) => b.tid - a.tid); //从大到小
    return Promise.resolve({ $: undefined, pageMax, posts });
  }

  /**
   * 解析列表页，获取种子信息
   * 对于按电源聚合多个种子的情况，要特殊处理
   * @param $
   * @param $tr
   * @param torrent
   */
  parsePageTr($: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) {
    let $tds = $tr.find('>td');
    let $tname = $tr.find('.torrentname');
    let $a = $tname.find('a').filter((j, x) => _.get(x.attribs, 'href', '').indexOf('details') >= 0);
    torrent.tid = parseInt(/id=(\d+)/.exec($a.attr('href'))[1]);
    torrent.title = $a.attr('title').trim();
    if (torrent.title.length == 0) {
      // debugger;
    }
    let $tdName = $a.closest('td');
    $a.remove();
    let textList = $tdName.contents().filter((j, x) => x.type == 'text');
    let tit2Node = _.last(textList);
    if (tit2Node != null) {
      let tit2 = tit2Node.data.trim();
      if (tit2.length > 0) {
        torrent.title2 = tit2;
      }
    }
    // if (torrent.title.indexOf('7 Minutes') >= 0) {
    //   debugger;
    // }

    let ctimeT = $tds.eq(3).find('span').attr('title');
    torrent.createTime = new Date(ctimeT);
    let sizeT = $tds.eq(4).text().trim();
    torrent._fsizeH = sizeT;
    torrent.fsize = bytes(sizeT);
    torrent.upNum = parseInt($tds.eq(5).text().trim());
    torrent._downloadNum = parseInt($tds.eq(6).text().trim());
    torrent._completeNum = parseInt($tds.eq(7).text().trim());
    torrent._isTop = $tname.find('img[alt=Sticky]').length > 0;
    torrent._isFree = $tname.find('.pro_free').length > 0 || $tname.find('.pro_free2up').length > 0;
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

  async startFetchFileInfos2(cates, mode?: number) {
    if (mode == null) mode = this.btCnf.fetchFileMode;
    let b = new BtTorrent({ site: this.btCnf.key });
    let pg = new Progress();

    async function* resIter() {
      for (let cate of cates) {
        pg.reset();
        let query = {
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
        };
        // query.bool.must_not.push({
        //     exists: {
        //         field: 'hasFiles',
        //     },
        // });
        //TODO 超时处理
        let scrollSearch = ESClient.inst().helpers.scrollSearch({
          index: b.indexName(),
          scroll: '1h',
          body: {
            size: 20,
            sort: [
              {
                createTime: {
                  order: 'desc',
                },
              },
            ],
            query,
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
      max: mode == BtSiteBaseConfig.FETCH_MODE_DOWNLOAD ? this.downloadThread : 3,
      onDo: async (bt: BtTorrent) => {
        if (bt.hasBt) return;
        await runSafe(
          async (retry) => {
            switch (mode) {
              case BtSiteBaseConfig.FETCH_MODE_DOWNLOAD:
                if (retry >= 10) {
                  //种子文件有问题
                  bt.deleteAt = new Date();
                  await bt.save();
                  this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 错误过多 删除`);
                  return;
                }
                //下载文件
                await this.downloadBtFile(bt.tid, this.btCnf.downloadDelay);

                this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} ${pg.fmt()}`);
                break;
              case BtSiteBaseConfig.FETCH_MODE_FETCH:
                //读取详情
                let flist = await this.fetchSubItems(bt);
                if (flist.length > 0) {
                  let bodys = flist.flatMap((x) => [
                    {
                      index: {
                        _index: x.indexName(),
                        _id: x.uniqId(),
                      },
                    },
                    x.getBody(),
                  ]);
                  let createRep = await ESClient.inst().bulk({ body: bodys });
                  ESClient.checkRep(createRep);
                }
                bt.hasFiles = true;
                await bt.save();
                this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 添加：${flist.length} ${pg.fmt()}`);
                break;
              case BtSiteBaseConfig.FETCH_MODE_TASK: //添加到task
                await WgwClient.inst().reseedAddTask(bt.site, bt.tid);
                this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} task ${pg.fmt()}`);
                break;
            }
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
    let $top = $('#top');
    if ($top.length == 0) {
      //不存在
      this.logger.error(`种子[${bt.id}]详情不存在`);
      bt.hash = BtTorrent.NOT_FOUND;
    } else {
      let $hash = $('#showfl').closest('tr');
      let hash = /Hash[^\w]+([a-z0-9]{10,})[^\w]/i.exec($hash.text());
      bt.hash = hash[1];
    }
    return bt as any;
  }

  async sendPost(cp: Post, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }

  async sendReply(post: Post, text: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  isHot(bt: BtTorrent): boolean {
    if (bt._isHot == null) {
      let durMinutes = moment().diff(bt.createTime, 'minutes');
      if (durMinutes <= 40) {
        bt._isHot = bt._downloadNum + bt._completeNum >= this.btCnf.hotRate[0];
      } else if (durMinutes <= 70) {
        bt._isHot = bt._downloadNum + bt._completeNum >= this.btCnf.hotRate[1];
      } else {
        bt._isHot = false;
      }
    }
    return bt._isHot;
  }

  watchFreeRulesCheck(bt: BtTorrent) {
    let ok = _.find(this.btCnf.watchRules, (r: any, k) => {
      if (r(bt)) {
        bt._watchReason = k;
        return true;
      }
    });
    return ok != null;
  }

  // 新的free种子
  async watchFree(checkHot: boolean, send = false): Promise<string> {
    await this.cache.load();
    let oldCache = _.defaultTo(this.cache.other.freeMap, {});
    let notifyHtml = ``;
    let hasNew = false;
    for (let cate of this.btCnf.torrentPages) {
      //第一页
      await this.loopCategory(cate, async (posts) => {
        // @ts-ignore
        let bts = posts as Array<BtTorrent>;
        let oldFreeList = _.defaultTo(oldCache[cate], []);
        let nextList = _.filter(bts, (b) => b._isFree || b._isTop || this.isHot(b) || this.watchFreeRulesCheck(b));
        let newFreeList = _.filter(nextList, (b) => oldFreeList.indexOf(b.tid) < 0);
        this.logger.info('找到新的', newFreeList.length);
        notifyHtml += `<div><h3>${cate}</h3></div>`;
        newFreeList.forEach((v) => {
          hasNew = true;
          notifyHtml += `<div>
<span>[${v.createTime.toLocaleString()}]</span>
${v._isTop ? `<span style="color: #7189d9">[Top]</span>` : ''}
${v._isFree ? `<span style="color: #0034ce">[Free]</span>` : ''}
${v._isHot ? `<span style="color: #e78d0f">[Hot]</span>` : ''}
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
    if (send && hasNew) WgwClient.inst().sendMail(`[BT] ${this.btCnf.key} Free`, notifyHtml);
    return hasNew ? notifyHtml : '';
  }

  async searchWeb(q: { hash?: string } = {}) {
    if (q.hash) {
      //搜索hash
    }
  }

  async downloadBtFile(tid: number, delay = 0) {
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
    if (delay > 0) {
      await sleep(delay, (v) => {
        if (delay > 30000) {
          this.logger.debug('downloadBtFile', v);
        }
      });
    }
    let btFile = fs.readFileSync(dFile as string);
    await this.fixBtData(tid, btFile).catch((e) => {
      // if (e.message.indexOf('Invalid data: Missing delimiter') >= 0) {
      if (e.stack.indexOf(path.join('node_modules', 'parse-torrent')) >= 0 || e.stack.indexOf(path.join('node_modules', 'bencode')) >= 0) {
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
  async fixBtData(tid: number, btFile: Buffer) {
    let bt = new BtTorrent();
    bt.site = this.btCnf.key;
    bt.tid = tid;
    if (await bt.loadById()) {
      if (!bt.hasBt) {
        let tInfo = parseTorrent(btFile);
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

  //签到
  async checkin(): Promise<boolean> {
    if (!this.btCnf.checkin) return true;
    if (this.btCnf.doCheckin != null) {
      return await this.btCnf.doCheckin(this);
    }
    let rep = await this.axiosInst.get('/attendance.php');
    // return rep.data;
    let $ = cheerio.load(rep.data);
    let txt = $('#outer').text();
    this.logger.info('签到', txt);
    return true;
  }

  //检查配置是否准确
  async checkConfig() {
    this.logger.info('检查cookie');
    await this.checkCookie();
    let checkCate = async (cate) => {
      let tag = `[${cate}]`;
      // 检查页
      this.logger.info(tag, '检查列表获取');
      let cateId = this.btCnf.torrentPages[0];
      let purl = this.getPostListUrl(cateId, 1);
      let pageRes = await this.fetchPage(purl, cateId);
      this.logger.info(tag, '最大页数', pageRes.pageMax);
      check.assert.greater(pageRes.pageMax, 3, tag + '页码解析失败');
      check.assert.greater(pageRes.posts.length, 10, tag + '列表解析失败');
      let topPost, freePost, numPost;
      for (let post of (pageRes.posts as any) as Array<BtTorrent>) {
        this.logger.info(JSON.stringify(post));
        check.assert.greater(post.tid, 0, tag + 'tid解析失败');
        check.assert.nonEmptyString(post.title, tag + '标题为空');
        check.assert.nonEmptyString(post.site, tag + 'site为空');
        check.assert.greater(post.createTime.getFullYear(), 1999, tag + 'createTime 失败');
        check.assert.integer(post.upNum, tag + 'upNum 失败');
        check.assert.integer(post._downloadNum, tag + '_downloadNum 失败');
        check.assert.integer(post._completeNum, tag + '_completeNum 失败');
        if (post.upNum + post._downloadNum + post._completeNum > 1) numPost = post;
        if (post._isFree) freePost = post;
        if (post._isTop) topPost = post;
      }
      //至少有一个置顶
      check.assert.assigned(numPost, tag + 'num失败');
      check.assert.assigned(freePost, tag + 'free失败');
      check.assert.assigned(topPost, tag + 'top失败');
    };
    // 检查全目录
    let oneByOne = true;
    oneByOne = false;
    let ps = [];
    for (let cate of this.btCnf.torrentPages) {
      let p = checkCate(cate);
      if (oneByOne) await p;
      else ps.push(p);
    }
    await Promise.all(ps);
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
     * --site=nicept --act=check
     * --site=nicept --act=list
     * --site=pthome --act=file --doCates=all
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
          { name: '添加种子任务', value: 'file2' },
          { name: '检查配置', value: 'check' },
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
      await site.startFindLinks(cates, { cacheSecond: 3 * 3600, poolSize: 3 });
      break;
    case 'file': //直接下载
    case 'file2': //添加任务分布式下载
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
      let mode = { file: BtSiteBaseConfig.FETCH_MODE_DOWNLOAD, file2: BtSiteBaseConfig.FETCH_MODE_TASK }[ua.act];
      await site.startFetchFileInfos2(doCates, mode);
      // if (mode == BtSiteBaseConfig.FETCH_MODE_DOWNLOAD && ['pthome'].indexOf(site.btCnf.key) >= 0) {
      //   //特殊处理
      //   while (true) {
      //     await site.startFetchFileInfos2(doCates, mode);
      //     await sleep(5 * 60 * 1000);
      //   }
      // }
      break;
    case 'check':
      await site
        .checkConfig()
        .then(() => {
          site.logger.info('检查通过');
        })
        .catch((e) => {
          site.logger.error('检查不通过', e);
        });
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
