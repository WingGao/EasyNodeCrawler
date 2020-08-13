import { SiteConfig } from './config';
import { SiteCrawler } from './site';

test('site', () => {
  let config = new SiteConfig();
  config.name = 'xk';
  config.host = 'bbs2.seikuu.com';
  config.https = true;
  // let crawler = new SiteCrawler(config);
});
