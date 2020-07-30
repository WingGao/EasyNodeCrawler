import SiteSeikuu from '../../sites/SiteSeikuu';
import path = require('path');
import brotli = require('brotli');
import { MainConfig, SiteConfig } from '../../core/config';
import { initConfig } from '../../core';
import SpamDiscuz from './discuz';

let testConfig: SiteConfig;
let spam: SpamDiscuz;
beforeAll(async () => {
  // console.log('init');
  if (MainConfig.default() == null) {
    await initConfig(path.resolve(__dirname, '../../../config/dev.yaml'));
  }
  testConfig = SiteSeikuu();
  testConfig.enableSave = false;
  spam = new SpamDiscuz(testConfig);
});

describe('discuz-测试Seikuu', () => {
  jest.setTimeout(3 * 60 * 1000);
  test('最新回复', async () => {
    // await spam.getLastReply('243457');
  });
  test('随机回复', async () => {
    await spam.createReply('243457');
    // let url = `https://bbs2.seikuu.com/forum.php?mod=forumdisplay&fid=43&filter=lastpost&orderby=lastpost`;
    // let res = await site.fetchPage(url);
    // expect(res.posts).toHaveLength(30);
  });
  test('水楼', async () => {
    await spam.shuiLou('243457', { checkInterval: 2 * 60 });
  });
});
