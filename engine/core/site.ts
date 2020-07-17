import { SiteConfig } from './config/config';

class SiteCrawler {
  config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  /**
   * 开启爬取
   */
  start() {}
}
