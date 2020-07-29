import { SiteCrawlerDiscuz } from './discuz';
import SiteSeikuu from '../../sites/SiteSeikuu';
import { initConfig } from '../index';
import path = require('path');
import brotli = require('brotli');
import { MainConfig, SiteConfig } from '../config';
import { Post } from '../post';

let testConfig: SiteConfig;
let site;
beforeAll(async () => {
  // console.log('init');
  if (MainConfig.default() == null) {
    await initConfig(path.resolve(__dirname, '../../../config/dev.yaml'));
  }
  testConfig = SiteSeikuu();
  testConfig.enableSave = false;
  site = new SiteCrawlerDiscuz(testConfig);
});
describe('discuz-测试Seikuu-列表', () => {
  test('列表解析', async () => {
    let url = `https://bbs2.seikuu.com/forum.php?mod=forumdisplay&fid=43&filter=lastpost&orderby=lastpost`;
    let res = await site.fetchPage(url);
    expect(res.posts).toHaveLength(30);
  });
});

describe('discuz-测试Seikuu-文章', () => {
  test('文章解析', async () => {
    let post = new Post();
    post.site = site.config.host;
    post.id = '243457';
    post.url = '/forum.php?mod=viewthread&tid=243457';
    await site.fetchPost(post);
    expect(post.replyNum).toBeGreaterThan(1);
  });

  test('文章解析-空内容', async () => {
    let post = new Post();
    post.site = site.config.host;
    post.id = '195340';
    post.url = '/forum.php?mod=viewthread&tid=195340';
    expect(await site.fetchPost(post)).toBeTruthy();
    expect(post.replyNum).toBeGreaterThan(1);
  });

  test('测试无权限板块', async () => {
    await site.fetchPage(47);
  });
});
