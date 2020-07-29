import { SiteCrawlerDiscuz } from './discuz';
import SiteSeikuu from '../../sites/SiteSeikuu';
import { initConfig } from '../index';
import path = require('path');
import brotli = require('brotli');
import { MainConfig } from '../config';

let testConfig;
let site;
beforeAll(async () => {
  // console.log('init');
  if (MainConfig.default() == null) {
    await initConfig(path.resolve(__dirname, '../../../config/dev.yaml'));
  }
  testConfig = SiteSeikuu();
  site = new SiteCrawlerDiscuz(testConfig);
});
describe('discuz-测试Seikuu', () => {
  test('测试无权限板块', async () => {
    await site.fetchPage(47);
  });
});
