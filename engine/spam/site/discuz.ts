import SpamNormal from './normal';
import { SiteCrawlerDiscuz } from '../../core/site';
import { SiteConfig } from '../../core/config';
import { addCookie } from '../../core/utils/selenium';

export default class SpamDiscuz extends SpamNormal {
  private crawler: SiteCrawlerDiscuz;
  constructor(config: SiteConfig) {
    super(config);
    this.crawler = new SiteCrawlerDiscuz(config);
  }

  async createReply() {
    let driver = await this.crawler.getSelenium();
    await addCookie(driver, this.config.cookie, this.config.host);
  }
  async start(args: { cates: Array<any> }) {}
}
