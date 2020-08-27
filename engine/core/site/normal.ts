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
import { addCookie, sleep } from '../utils';
import { scalarOptions } from 'yaml';
import * as moment from 'moment';

export interface IPostParseConfig {
  onlyMain?: boolean;
  pageUrlExt?: string;
  axConfig?: any;
}
export abstract class SiteCrawler {
  config: SiteConfig;
  axiosInst: AxiosInstance;
  queue: Queue;
  logger: Logger;
  private driver: WebDriver;
  lastReplyTime: number = 0; //最后回复时间

  constructor(config: SiteConfig) {
    this.config = config;
    let axc: AxiosRequestConfig = {
      headers: _.merge(
        {
          'user-agent': MainConfig.default().userAgent,
          cookie: _.defaultTo(config.cookie, ''),
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
    // TODO 更好的代理轮训
    if (_.size(config.proxys) > 0) {
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
    this.axiosInst = axios.create(axc);
    // 单个站点单个队列
    this.queue = new Queue(this._queueName(), {
      connection: {
        ...MainConfig.default().redis,
      },
    });
    this.logger = getLogger(`site:${config.name}`);
    this.logger.level = config.logLevel;
    this.logger.debug('init', config.name);
  }

  abstract checkPermission($): boolean;

  async fetchPage(
    pageUrl,
    cateId?,
    cnf?: { axConfig?: any },
  ): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    this.logger.info('获取', pageUrl);
    let rep = await this.axiosInst.get(pageUrl, cnf ? cnf.axConfig : undefined);
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
  abstract parsePage(
    $: CheerioStatic,
    cateId?,
    html?: string,
  ): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }>;
  /**
   * 开始获取正文所在链接操作，一般爬虫是获取一个目录，根据分页爬取
   */
  async startFindLinks(cates: any[], cnf: IPostParseConfig = {}) {
    for (let cate of cates) {
      this.logger.info('获取链接', JSON.stringify(cate));
      await this.loopCategory(
        cate.id,
        async (posts) => {
          let ps: any = posts.map((v) => {
            //添加到队列
            return this.queueAddPost(v);
          });
          this.logger.info('添加任务', ps.length);
          await Promise.all(ps);
          return true;
        },
        cnf,
      );
    }
    this.logger.info('获取post链接完毕');
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

  newPost() {
    let p = new Post();
    p.site = this.config.key;
    return p;
  }

  /**
   * 将post添加到队列
   * @param post
   */
  queueAddPost(post: Post) {
    if (this.config.savePageResult) {
      return post.save();
    }
    return this.queue.add('post', post, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2 * 60 * 1000,
      }, //默认重试
    });
  }

  // 专门解析post
  abstract async parsePost(post: Post, $, pcf?: IPostParseConfig): Promise<Post>;

  async fetchPost(post: Post, pcf?: IPostParseConfig) {
    let rep = await this.axiosInst.get(this.config.fullUrl(post.url));
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
      let driver = await new Builder().forBrowser('firefox').build();
      await addCookie(driver, this.config.cookie, this.config.fullUrl('/'));
      this.driver = driver;
    }
    return this.driver;
  }

  abstract getPostUrl(pid, page?: number): string;
  abstract getPostListUrl(cateId, page?: number, ext?: string): string;

  abstract async sendReply(post: Post, text: string);

  // 一般爬取都是从新往旧的爬
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
    for (let page = 1; page <= pageG; page++) {
      let purl = this.getPostListUrl(cateId, page, cnf.pageUrlExt);
      let { posts, $, pageMax } = await this.fetchPage(purl, cateId, { axConfig: cnf.axConfig });
      if (page == 1) {
        this.logger.debug(`最大页数 ${pageMax}`);
      }
      pageG = pageMax;
      let ok = await cb(posts);
      if (!ok) {
        break;
      }
    }
  }

  //签到
  async checkin(): Promise<boolean> {
    return false;
  }
}

export function createFromConfig(config: SiteConfig) {
  let sc: SiteCrawler;
  switch (config.siteType) {
  }
  return sc;
}
