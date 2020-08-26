import { SiteCrawlerDiscuz } from './discuz';
import SiteSeikuu from '../../sites/SiteSeikuu';
import { initConfig } from '../index';
import path = require('path');
import brotli = require('brotli');
import { MainConfig, SiteConfig } from '../config';
import { Post } from '../post';
import SiteHorou from '../../sites/SiteHorou';
import SiteAbooky from '../../sites/SiteAbooky';
import SiteSport163 from './sport163';

let testConfig: SiteConfig;
let site: SiteSport163;
beforeAll(async () => {
  // console.log('init');
  if (MainConfig.default() == null) {
    await initConfig(path.resolve(__dirname, '../../../config/dev.yaml'));
  }

  site = new SiteSport163();
  jest.setTimeout(3 * 60 * 1000);
});
describe('sport163-列表', () => {
  test('列表解析', async () => {
    let url = site.getPostListUrl('', 2);
    let res = await site.fetchPage(url);
    expect(res.posts).toHaveLength(30);
  });
  test('获取文章', async () => {
    let p = new Post();
    p.id = 'FKUJM1LF00058781';
    p.url = 'https://sports.163.com/20/0826/07/FKUJM1LF00058781.html';
    p._ext = { commenturl: 'http://comment.tie.163.com/FKUJM1LF00058781.html' };
    let r = await site.fetchPost(p, { onlyMain: false });
    expect(r.body).not.toBeNull();
    expect(r._replyList.length).toBeGreaterThan(1);
  });
});
