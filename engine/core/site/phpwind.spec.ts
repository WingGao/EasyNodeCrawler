import { SiteCrawlerDiscuz } from './discuz';
import SiteSeikuu from '../../sites/SiteSeikuu';
import { initConfig } from '../index';
import path = require('path');
import brotli = require('brotli');
import { MainConfig, SiteConfig } from '../config';
import { Post } from '../post';
import SiteSouthPlus from '../../sites/SiteSouthPlus';
import { SiteCrawlerPhpwind } from './phpwind';

let testConfig: SiteConfig;
let site: SiteCrawlerPhpwind;
beforeAll(async () => {
  jest.setTimeout(3 * 60 * 1000);
  // console.log('init');
  if (MainConfig.default() == null) {
    await initConfig(path.resolve(__dirname, '../../../config/dev.yaml'));
  }
  testConfig = SiteSouthPlus();
  testConfig.enableSave = false;
  site = new SiteCrawlerPhpwind(testConfig);
});

describe('phpwind', () => {
  test('cookie', async () => {
    let res = await site.checkCookie();
    expect(res).toBeTruthy();
  });
  test('获取目录', async () => {
    let res = await site.listCategory();
    expect(res).toBeFalsy();
  });
  //测试回复
  test('回复', async () => {
    let p = new Post();
    p.id = '911529';
    p.categoryId = '128';
    // await site.createReply(p, '感谢分享');
    await site.sendReply(p, '感 [s:701] 谢 [s:692] 分[s:705] 享 [s:692] ');
  });
});
describe('phpwind-列表', () => {
  test('列表解析', async () => {
    let url = `https://south-plus.org/thread.php?fid=128&page=1`;
    let res = await site.fetchPage(url, null);
    expect(res.posts.length).toBeGreaterThan(30);
    expect(res.pageMax).toBeGreaterThan(200);
  });
});

describe('phpwind-文章', () => {
  test('文章解析', async () => {
    let post = new Post();
    post.site = site.config.host;
    post.id = '913473';
    post.url = site.getPostUrl(post.id);
    await site.fetchPost(post, { onlyMain: false });
    expect(post.body.length).toBeGreaterThan(1);
    expect(post._replyList.length).toBeGreaterThan(1);
    post.body = null;
    post.url = site.getPostUrl(post.id, 2);
    await site.fetchPost(post, { onlyMain: false });
    expect(post.body).toBeNull();
  });

  test('文章解析-空内容', async () => {
    let post = new Post();
    post.site = site.config.host;
    post.id = '195340';
    post.url = '/forum.php?mod=viewthread&tid=195340';
    expect(await site.fetchPost(post)).toBeTruthy();
    expect(post.replyNum).toBeGreaterThan(1);
  });
  test('文章解析-无法回复', async () => {
    let post = new Post();
    post.site = site.config.host;
    post.id = '86067';
    post.url = '/forum.php?mod=viewthread&tid=86067';
    expect(await site.fetchPost(post)).toBeTruthy();
    expect(post.canReply).toBeFalsy();
  });
});
