import SpamNormal from './normal';
import { SiteCrawlerDiscuz } from '../../core/site';
import { SiteConfig } from '../../core/config';

export default class SpamDiscuz extends SpamNormal {
  private crawler: SiteCrawlerDiscuz;
  constructor(config: SiteConfig) {
    super(config);
    this.crawler = new SiteCrawlerDiscuz(config);
  }

  async start(args: { cates: Array<any> }) {}
}
