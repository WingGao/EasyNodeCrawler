import { MainConfig, SiteConfig, SiteType } from '../config';
import { getLogger, Logger } from 'log4js';
import * as _ from 'lodash';
import * as Crawler from 'crawler';
import { Post } from '../post';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as iconv from 'iconv-lite';
import { Queue, QueueEvents, Worker } from 'bullmq';
import Redis from '../redis';
import cheerio = require('cheerio');
import { WebDriver } from 'selenium-webdriver';
import { addCookie, execaCn, Progress, runSafe, sleep, waitUntilLoad } from '../utils';
import * as moment from 'moment';
import * as fs from 'fs';
import cookies from '../../sites/cookie';
import path = require('path');
import ResourceTask from '../utils/resourceTask';
import SiteCacheInfo from '../config/cache';
import got from 'got';
import ESClient from '../es';

export interface IPostParseConfig {
  onlyMain?: boolean;
  pageUrlExt?: string;
  axConfig?: any;
  cachePrefix?: any; //判断是否遍历过
  cacheSecond?: number; //缓存多久，默认1小时
  poolSize?: number;
  maxPage?: number; //最大页数
}

export interface IPostFetchConfig {
  poolSize?: number;
  fetchPostsQueryBuild?: (query: any) => any;
  postNeedFetch?: (p: Post) => boolean; //true=需要爬取
  doFetch?: (p: Post) => Promise<Post>;
}

export abstract class SiteCrawler {
  config: SiteConfig;
  axiosInst: AxiosInstance;
  queue: Queue;
  logger: Logger;
  cache: SiteCacheInfo;
  private driver: WebDriver;
  lastReplyTime: number = 0; //最后回复时间
  isCheckIn = false; //是否签到

  constructor(config: SiteConfig) {
    // 获取默认cookie
    if (config.cookie == null && cookies[config.host]) {
      config.cookie = cookies[config.host].cookie;
    }
    this.config = config;
    let cname = _.defaultTo(config.name, config.key);
    this.logger = getLogger(`site:${cname}`);
    this.logger.level = config.logLevel;
    this.logger.debug('init', cname);

    let axc: AxiosRequestConfig = {
      baseURL: this.config.fullUrl(''),
      headers: _.merge(
        {
          'User-Agent': MainConfig.default().userAgent,
          Cookie: _.defaultTo(config.cookie, ''),
          // 'Cache-Control': 'no-cache',
          // 'Accept-Encoding': 'gzip, deflate, br',
          // 'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
          // Pragma: 'no-cache',
          Connection: 'keep-alive', //有些nginx需要该头
        },
        config.getHeaders(),
      ),
      responseType: 'arraybuffer',
      transformResponse: [
        (data, headers) => {
          if ((headers['content-type'] && headers['content-type'].indexOf('gbk') > 0) || this.config.charset == 'gbk') {
            return iconv.decode(data, 'gbk');
          }
          // debugger;
          return data.toString();
        },
      ],
    };
    //添加默认代理
    if (_.size(config.proxys) == 0 && MainConfig.default().proxy) {
      config.proxys = [MainConfig.default().proxy];
    }
    // TODO 更好的代理轮训
    if (_.size(config.proxys) > 0) {
      this.logger.info('使用代理', JSON.stringify(config.proxys));
      let p = config.proxys[0];
      switch (p.type) {
        case 'http':
          axc.proxy = {
            host: p.host,
            port: p.port,
          };
          break;
        case 'sock5':
          let httpAgent = new SocksProxyAgent({
            host: p.host,
            port: p.port,
          });
          axc.httpAgent = httpAgent;
          axc.httpsAgent = httpAgent;
          break;
      }
    }
    if (config.useGot) {
      let gotInst = got.extend({
        prefixUrl: axc.baseURL,
        headers: axc.headers,
      });

      this.axiosInst = {
        get: gotInst.get,
        post: (url, data, config) => {
          let b = {} as any;
          if (_.isString(data)) b.body = data;

          return gotInst.post(url, b);
        },
      } as any;
    } else {
      this.axiosInst = axios.create(axc);
    }
    // 单个站点单个队列
    this.queue = new Queue(this._queueName(), {
      connection: {
        ...MainConfig.default().redis,
      },
    });
  }

  async init() {
    this.cache = new SiteCacheInfo();
    await this.cache.load(this.config.key);
    if (this.config.selenium) {
      await this.getSelenium();
    }
    await this.checkCookie();
  }

  async checkIP() {
    let rep = await this.axiosInst.get('https://202020.ip138.com/');
    let g = /(\d+\.\d+\.\d+\.\d+)<\/a>/.exec(rep.data);
    return g[1];
  }

  abstract checkPermission($): boolean;

  async fetchPage(pageUrl, cateId?, cnf?: { axConfig?: any }): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    this.logger.info('获取', pageUrl);
    let rep = await this.autoFetchPage(pageUrl, cnf ? cnf.axConfig : undefined);
    let $ = cheerio.load(rep.data);
    if (!this.checkPermission($)) {
      //没有权限
      return;
    }
    let res = await this.parsePage($, cateId, rep.data);
    // 排除黑名单
    res.posts = _.filter(res.posts, (v) => {
      if (v.categoryId == null) v.categoryId = cateId;
      return this.config.postBlacklist.indexOf(v.id) < 0;
    });
    return res;
  }

  abstract parsePage($: CheerioStatic, cateId?, html?: string): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }>;

  /**
   * 开始获取正文所在链接操作，一般爬虫是获取一个目录，根据分页爬取
   * 一般爬取都是从新往旧的爬
   */
  async startFindLinks(cates: any[], cnf: IPostParseConfig = {}) {
    cnf.cachePrefix = 'startFindLinks';
    for (let cate of cates) {
      this.logger.info('获取链接', JSON.stringify(cate));
      let lastId = null;
      let hasLastId = this.cache.cateLastMap[cate.id] != null;
      let cateCnf = _.cloneDeep(cnf);
      if (hasLastId) {
        //如果有增量一定是顺序任务
        cateCnf.poolSize = 1;
      }
      await this.loopCategory(
        cate.id,
        async (posts) => {
          let ok = true;
          let ps = [];
          let listFirstPostId = null; //当前页第一个post
          // 这里的post都是从新到旧排列（id从大到小）
          for (let p of posts) {
            if (lastId == null) lastId = p.id; //获取最新的id
            if (!ok) break;

            let needCheckOld = false;
            switch (this.config.pageResultCheck) {
              case 1:
                needCheckOld = !p._ignoreOld && p._isTop != true;
                break;
              case 2: //没有新的，才停止
                if (listFirstPostId == null && p._isTop != true) {
                  listFirstPostId = p.id;
                  needCheckOld = true;
                }
                break;
            }
            //检查是否存在,跳过置顶的检查
            if (needCheckOld && (await this.linkIsOld(p))) {
              this.logger.info('增量检查到', p.id);
              ok = false;
              break;
            }
            //添加到队列
            ps.push(this.queueAddPost(p));
          }
          let orLen = ps.length;
          this.logger.info('获取任务', orLen);
          let addArr = await Promise.all(ps);
          let addLen = _.filter(addArr, (v) => v != null).length;
          this.logger.info(`添加任务${addLen}/${orLen}`);
          return ok;
        },
        cateCnf,
      );
      //只有完成才获取
      this.cache.cateLastMap[cate.id] = lastId;
      await this.cache.save();
    }
    this.logger.info('获取post链接完毕');
  }

  /**
   * 根据数据库里的post来获取post
   * @param cates
   * @param cnf
   */
  async startFetchPosts(cates: any[], cnf: IPostFetchConfig = {}) {
    let b = this.newPost();
    let pg = new Progress();
    let this_ = this;

    //查询post
    async function* resIter() {
      try {
        for (let cate of cates) {
          pg.reset();
          let query = {
            bool: {
              must: [
                {
                  term: {
                    categoryId: cate.id,
                  },
                },
              ],
              must_not: [
                {
                  exists: {
                    field: 'deleteAt',
                  },
                },
              ],
            },
          };
          if (cnf.fetchPostsQueryBuild) query = cnf.fetchPostsQueryBuild(query);
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
            for (let bt of result.body.hits.hits) {
              let btv = this_.newPost(bt._source);
              yield btv;
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    //爬取post的task
    let task = new ResourceTask({
      createIter: resIter(),
      max: _.defaultTo(cnf.poolSize, 3),
      onDo: async (bt: Post) => {
        //判断是否需要爬取
        let needFetch = _.size(bt.body) == 0;
        if (cnf.postNeedFetch) {
          needFetch = cnf.postNeedFetch(bt);
        }
        pg.incr();
        if (needFetch) {
          this_.logger.info('爬取', this_.getPostUrl(bt.id), pg.fmt());
          if (cnf.doFetch) bt = await cnf.doFetch(bt);
          else bt = await this.fetchPost(bt);
          this_.logger.info('保存', bt.uniqId(), pg.fmt());
          await bt.save();
        } else {
          this_.logger.info('跳过', bt.uniqId(), pg.fmt());
        }

        //保存
        // await runSafe(
        //   async (retry) => {
        //     switch (mode) {
        //       case BtCrawler.FETCH_MODE_DOWNLOAD:
        //         if (retry >= 10) {
        //           //种子文件有问题
        //           bt.deleteAt = new Date();
        //           await bt.save();
        //           this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 错误过多 删除`);
        //           return;
        //         }
        //         //下载文件
        //         await this.downloadBtFile(bt.tid, this.btCnf.downloadDelay);
        //
        //         this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} ${pg.fmt()}`);
        //         break;
        //       case BtCrawler.FETCH_MODE_FETCH:
        //         //读取详情
        //         let flist = await this.fetchSubItems(bt);
        //         if (flist.length > 0) {
        //           let bodys = flist.flatMap((x) => [
        //             {
        //               index: {
        //                 _index: x.indexName(),
        //                 _id: x.uniqId(),
        //               },
        //             },
        //             x.getBody(),
        //           ]);
        //           let createRep = await ESClient.inst().bulk({ body: bodys });
        //           ESClient.checkRep(createRep);
        //         }
        //         bt.hasFiles = true;
        //         await bt.save();
        //         this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} 添加：${flist.length} ${pg.fmt()}`);
        //         break;
        //       case BtCrawler.FETCH_MODE_TASK: //添加到task
        //         await WgwClient.inst().reseedAddTask(bt.site, bt.tid);
        //         this.logger.info(`startFetchFileInfos ${bt.tid} ${bt.title} task ${pg.fmt()}`);
        //         break;
        //     }
        //     pg.incr();
        //   },
        //   async (e) => {
        //     this.logger.error(e);
        //     return false;
        //   },
        // );
      },
    });
    task.start();
    await task.wait();
    this.logger.info('startFetchPosts完成');
  }

  // 判断是否已经获取到旧文章了，如果是，则应该停止爬取
  async linkIsOld(p: Post): Promise<boolean> {
    let last = this.cache.cateLastMap[p.categoryId];
    if (last == null) return false;
    else return parseInt(p.id) <= parseInt(last);
  }

  async getFormData($form) {
    let data = {};
    $form.find('input').each((i, ipt) => {
      let ttype = ipt.attribs.type;
      if (ttype == 'submit' || ttype == 'checkbox' || ipt.attribs.disabled != null) {
        return;
      } else {
        let name = ipt.attribs.name;
        let value = ipt.attribs.value;
        data[name] = value;
      }
    });
    return data;
  }

  //自动判断获取页面的方式
  async autoFetchPage(url, cnf?) {
    if (this.config.selenium) {
      let d = await this.getSelenium();
      let fu = this.config.fullUrl(url);
      await d.get(fu);
      await waitUntilLoad(d);
      let html = await d.getPageSource();
      return { data: html };
    } else {
      return await this.axiosInst.get(url, cnf);
    }
  }

  /**
   * 开启爬取
   */
  start() {
    let c = this.getCrawler();
    // Queue just one URL, with default callback
    c.queue(this.config.fullUrl('/'));
  }

  getCrawler() {
    const c = new Crawler(
      _.merge(
        {
          preRequest: (options, done) => {
            if (this.config.beforeReq) {
              this.config.beforeReq(options, done);
            } else {
              done();
            }
          },
          callback: (error, res, done) => {
            if (error) {
              this.logger.error(error);
              done();
            } else {
              const $ = res.$;
              // $ is Cheerio by default
              //a lean implementation of core jQuery designed specifically for the server
              console.log($('title').text());
              if (this.config.afterReq) {
                this.config.afterReq(res, done);
              } else {
                done();
              }
            }
          },
        },
        this.config.crawler,
      ),
    );
    return c;
  }

  abstract async checkCookie();

  _queueName() {
    return `node_crawler:queue:${this.config.key}`;
  }

  newPost(b?) {
    let p = new Post(b);
    p.site = this.config.key;
    return p;
  }

  /**
   * 将post添加到队列
   * @param post
   */
  async queueAddPost(post: Post) {
    if (this.config.pageResultSave) {
      // 先判断是否存在
      if ((await post.getById(post.uniqId())) != null) {
        // this.logger.info('Post已存在', post.uniqId());
        return;
      }
      return await post.save();
    }
    return await this.queue.add('post', post, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2 * 60 * 1000,
      }, //默认重试
    });
  }

  // 专门解析post
  abstract async parsePost(post: Post, $: CheerioStatic, pcf?: IPostParseConfig): Promise<Post>;

  async fetchPost(post: Post, pcf?: IPostParseConfig) {
    let purl = post.url ? this.config.fullUrl(post.url) : this.getPostUrl(post.id);
    let rep = await this.axiosInst.get(purl);
    post = await this.parsePost(post, cheerio.load(rep.data), pcf);
    return post;
  }

  async fetchPostAndSave(post: Post) {
    // 先判断是否存在
    if ((await post.getById(post.uniqId())) != null) {
      this.logger.info('Post已存在', post.uniqId());
      return true;
    }
    let lockKey = 'lock:' + post.uniqId();
    if ((await Redis.lock(lockKey)) == true) {
      post = await this.fetchPost(post);
      if (post != null && this.config.enableSave) {
        //那些有问题的post不保存
        await post.save();
        this.logger.info('Post保存', post.uniqId(), post.title);
      }
      await Redis.unlock(lockKey);
      return true;
    } else {
      // 有其他程序，应该delay
      return false;
    }
  }

  async startWorker() {
    //TODO 目前是单个worker
    const worker = new Worker(
      this._queueName(),
      async (job) => {
        let p = this.newPost();
        p = _.merge(p, job.data);
        await this.fetchPostAndSave(p);
      },
      {
        connection: {
          ...MainConfig.default().redis,
        },
      },
    );
    worker.on('failed', (job, err) => {
      this.logger.error(`${job.id} ${job.data.url} has failed with ${err.message}`);
    });

    const queueEvents = new QueueEvents(this._queueName(), {
      connection: {
        ...MainConfig.default().redis,
      },
    });

    queueEvents.on('progress', ({ jobId, data }, timestamp) => {
      console.log(`${jobId} reported progress ${data} at ${timestamp}`);
    });
  }

  // selenium
  async getSelenium(): Promise<WebDriver> {
    if (this.driver == null) {
      const { Builder, By, Key, until } = require('selenium-webdriver');
      const { Options } = require('selenium-webdriver/firefox');
      let profile = new Options();
      //禁止图片
      profile.setPreference('permissions.default.image', 2);
      let driver = await new Builder().forBrowser('firefox').setFirefoxOptions(profile).build();
      await addCookie(driver, this.config.cookie, this.config.fullUrl('/'));
      this.driver = driver;
    }
    return this.driver;
  }

  abstract getPostUrl(pid, page?: number): string;

  abstract getPostListUrl(cateId, page?: number, ext?: string): string;

  abstract async sendReply(post: Post, text: string);

  async sendReplyLimit(post: Post, text: string) {
    let delay = new Date().getTime() - this.lastReplyTime;
    delay = this.config.replyTimeSecond * 1000 - delay;
    if (delay > 0) {
      this.logger.info('等待回帖', post.id, moment.duration(delay).toISOString());
      await sleep(delay);
    }
    await this.sendReply(post, text);
    this.lastReplyTime = new Date().getTime();
  }

  abstract async sendPost(cp: Post, ext?: any): Promise<boolean>;

  async loopCategory(
    cateId,
    cb: (posts: Array<Post>) => Promise<boolean>, //true继续，false结束
    cnf: IPostParseConfig = {},
  ) {
    let pageG = 1;
    let poolSize = _.defaultTo(cnf.poolSize, 1);
    let pageRes = [];
    let fetchAct = async (page: number) => {
      let ok = true;
      let visitKey;
      await runSafe(
        async () => {
          let purl = this.getPostListUrl(cateId, page, cnf.pageUrlExt);
          if (page > 1) {
            if (cnf.cachePrefix != null && cnf.cacheSecond != 0) {
              visitKey = `${MainConfig.default().dataPrefix}:${this.config.key}:visited:${cnf.cachePrefix}:` + `${cateId}:page-${page}`;
              //判断是否遍历过
              let visited = await Redis.inst().get(visitKey);
              if (visited != null) {
                this.logger.debug('visited', purl);
                return;
              }
            }
          }
          let { posts, $, pageMax } = await this.fetchPage(purl, cateId, { axConfig: cnf.axConfig });
          if (page == 1) {
            //只赋值一次
            this.logger.debug(`最大页数 ${pageMax}`);
            pageG = pageMax;
          }
          ok = await cb(posts);
          if (visitKey) await Redis.inst().setex(visitKey, _.defaultTo(cnf.cacheSecond, 3600), 1);
        },
        async (e) => {
          this.logger.error(e);
          return false;
        },
      );
      //TODO 多个pool的停止问题
      return ok;
    };
    for (let page = 1; page <= pageG; page++) {
      //到达上限
      if (cnf.maxPage != null && cnf.maxPage < page) break;
      let ok; //只对 poolSize==1的才生效
      if (page == 1 || poolSize <= 1) {
        ok = await fetchAct(page);
      } else {
        pageRes.push(page);
        ok = true;
      }
      if (!ok) {
        break;
      }
    }
    if (pageRes.length > 0) {
      let task = new ResourceTask({
        resourceArr: pageRes,
        onDo: fetchAct,
        max: poolSize,
      });
      task.start();
      await task.wait();
    }
  }

  //签到
  async checkin(): Promise<boolean> {
    return false;
  }

  ensureTempDir() {
    if (!fs.existsSync(this.config.tempPath)) {
      fs.mkdirSync(this.config.tempPath);
    }
  }

  // 下载文件
  async download(furl: string, cnf: { desFile?: string; desDir?: string; createDir?: boolean } = {}) {
    let { desFile } = cnf;
    if (desFile == null) {
      desFile = furl.replace(/[:/?]/gi, '_');
    }
    if (!path.isAbsolute(desFile)) {
      desFile = path.resolve(_.defaultTo(cnf.desDir, this.config.tempPath), desFile);
    }
    if (fs.existsSync(desFile)) {
      this.logger.info(`download ${desFile} 已存在`);
      return desFile;
    }
    if (cnf.createDir) {
      //创建目录
      let dir = path.dirname(desFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.logger.info(`download ${furl} to ${desFile} 开始`);
    let rep = await this.axiosInst.get(furl, {
      responseType: 'stream',
      transformResponse: (d) => d,
    });
    let tmpFile = desFile + '.tmp';
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
    let d = rep.data.pipe(fs.createWriteStream(tmpFile, { emitClose: true }));
    await new Promise((resolve) =>
      d.on('close', () => {
        resolve();
      }),
    );
    fs.renameSync(tmpFile, desFile);

    this.logger.info(`download ${furl} to ${desFile} 完成`);
    return desFile;
  }
}

export function createFromConfig(config: SiteConfig) {
  let sc: SiteCrawler;
  switch (config.siteType) {
  }
  return sc;
}

export class NormalCrawler extends SiteCrawler {
  async checkCookie(): Promise<any> {
    return true;
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page?: number, ext?: string): string {
    return '';
  }

  getPostUrl(pid, page?: number): string {
    return '';
  }

  parsePage($: CheerioStatic, cateId?, html?: string): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    return Promise.resolve({ $: undefined, pageMax: 0, posts: undefined });
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
