import { SiteConfig, SiteType } from '../config';
import { getLogger, Logger } from 'log4js';
import * as _ from 'lodash';
import * as Crawler from 'crawler';
import { Post } from '../post';
import axios, { AxiosInstance } from 'axios';
import * as iconv from 'iconv-lite';

export class SiteCrawler {
  config: SiteConfig;
  axiosInst: AxiosInstance;
  private logger: Logger;

  constructor(config: SiteConfig) {
    this.config = config;
    this.axiosInst = axios.create({
      headers: config.getHeaders(),
      responseType: 'arraybuffer',
      transformResponse: [
        (data, headers) => {
          if (headers['content-type'] && headers['content-type'].indexOf('gbk') > 0) {
            return iconv.decode(data, 'gbk');
          }
          debugger;
          return data;
        },
      ],
    });
    this.logger = getLogger(`site:${config.name}`);
    this.logger.level = config.logLevel;
    this.logger.debug('init', config);
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

  async checkCookie(): Promise<any> {
    throw new Error('未支持checkCookie');
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
