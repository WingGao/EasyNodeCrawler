import { SiteConfig } from './config';

test('site', () => {
  let config = new SiteConfig();
  config.name = 'xk';
  config.host = 'bbs2.seikuu.com';
  config.https = true;
  let site = new SiteConfig();
});
