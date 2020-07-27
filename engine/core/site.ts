import { SiteConfig, SiteType } from './config';
import { getLogger, Logger } from 'log4js';
import * as _ from 'lodash';
import * as Crawler from 'crawler';
import { Post } from './post';

export class SiteCrawler {
  config: SiteConfig;
  private logger: Logger;

  constructor(config: SiteConfig) {
    this.config = config;

    this.logger = getLogger(`site:${config.name}`);
    this.logger.level = config.logLevel;
    this.logger.debug('init', config);
  }

  /**
   * 开启爬取
   */
  start() {
    const c = new Crawler({
      maxConnections: 10,
      // This will be called for each crawled page
      callback: (error, res, done) => {
        if (error) {
          this.logger.error(error);
          done();
        } else {
          const $ = res.$;
          // $ is Cheerio by default
          //a lean implementation of core jQuery designed specifically for the server
          console.log($('title').text());
          this.config.afterReq(res, done);
        }
      },
    });

    // Queue just one URL, with default callback
    c.queue('http://www.amazon.com');
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
