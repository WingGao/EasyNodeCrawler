import { MainConfig, SiteConfig } from '../config';
import { SiteCrawlerPhpwind } from './phpwind';
import { initConfig } from '../index';
import SiteSouthPlus from '../../sites/SiteSouthPlus';
import * as path from 'path';
import SiteZxcsCrawler from './zxcs';

let site: SiteZxcsCrawler;
beforeAll(async () => {
  jest.setTimeout(3 * 60 * 1000);
  // console.log('init');
  if (MainConfig.default() == null) {
    await initConfig(path.resolve(__dirname, '../../../config/dev.yaml'));
  }

  site = new SiteZxcsCrawler();
});
test('zxcs-目录', async () => {
  console.log(JSON.stringify(await site.listCategory()));
});
