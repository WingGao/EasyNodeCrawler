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
import { addCookie } from '../utils';

export class SiteCrawler {
  config: SiteConfig;
  axiosInst: AxiosInstance;
  queue: Queue;
  logger: Logger;
  private driver: WebDriver;

  constructor(config: SiteConfig) {
    this.config = config;
    let axc: AxiosRequestConfig = {
      headers: _.merge(
        {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36',
        },
        config.getHeaders(),
      ),
      responseType: 'arraybuffer',
      transformResponse: [
        (data, headers) => {
          if (headers['content-type'] && headers['content-type'].indexOf('gbk') > 0) {
            return iconv.decode(data, 'gbk');
          }
          // debugger;
          return data;
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

  /**
   * 开始获取正文所在链接操作，一般爬虫是获取一个目录，根据分页爬取
   */
  async startFindLinks() {}
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

  async checkCookie(): Promise<any> {
    throw new Error('未支持checkCookie');
  }

  _queueName() {
    return `node_crawler:queue:${this.config.host}`;
  }

  createPost() {
    let p = new Post();
    p.site = this.config.host;
    return p;
  }

  /**
   * 将post添加到队列
   * @param post
   */
  queueAddPost(post: Post) {
    return this.queue.add('post', post, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2 * 60 * 1000,
      }, //默认重试
    });
  }
  // 专门解析post
  async parsePost(post: Post, $, pcf?: any) {
    return post;
  }

  async fetchPost(post: Post, pcf?: any) {
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
        // Will print { foo: 'bar'} for the first job
        // and { qux: 'baz' } for the second.
        let p = this.createPost();
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
}

export function createFromConfig(config: SiteConfig) {
  let sc: SiteCrawler;
  switch (config.siteType) {
    case SiteType.Normal:
    default:
      sc = new SiteCrawler(config);
      break;
  }
  return sc;
}
