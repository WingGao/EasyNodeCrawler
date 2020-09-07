import { MainConfig, SiteConfig } from '../../config';
import { SiteCrawlerDiscuz } from '../discuz';
import { initConfig } from '../../index';
import SiteShuyue from '../../../sites/SiteShuyue';
import MTeamConfig from './sitecnf/pt_mteam_cc';
import { BtCrawler } from './index';
import { BtSiteBaseConfig } from './sitecnf/base';
import { Post } from '../../post';
import { BtSubItem, BtTorrent } from './model';
import ESClient from '../../es';

let testConfig: BtSiteBaseConfig;
let site: BtCrawler;
let btMod = new BtTorrent();
let subMod = new BtSubItem();
beforeAll(async () => {
  if (MainConfig.default() == null) {
    await initConfig();
  }
  testConfig = MTeamConfig;
  site = new BtCrawler(testConfig);
  await site.init();
  jest.setTimeout(30 * 60 * 1000);
});
describe('bt', () => {
  test('init', async () => {
    expect(await site.checkCookie()).toBeTruthy();
  });
  test('list', async () => {
    let res = await site.fetchPage(site.getPostListUrl(testConfig.torrentPages[0]));
    expect(res.pageMax).toBeGreaterThan(10);
  });
  test('btFile', async () => {
    let p = new BtTorrent();
    p.tid = 426654;
    let res = await site.fetchSubItems(p);
    expect(res);
  });
  test('btPost', async () => {
    let p = new BtTorrent();
    p.tid = 426654;
    let res = await site.fetchPost(p as any);
    expect(p.hash).toEqual('e3374e621af2f5e4483115abcd5d520165b7d1c2');
  });
  test('watchFree', async () => {
    let html = await site.watchFree();
    expect(html.length).toBeGreaterThan(1);
  });

  test('findSimilarTorrent-file', async () => {
    let r = await site.findSimilarTorrent({ btPath: 'D:\\tmp\\ec667120e2636400.torrent' });
  });

  test('downloadFile', async () => {
    let r = await site.downloadBtFile(401297);
  });

  test('x', () => {
    let a = {
      cateLastMap: {
        '/torrents.php': 426642,
        '/music.php': 426631,
        '/adult.php': 426187,
      },
      site: 'mteam',
    };
    console.log(JSON.stringify({ a: JSON.stringify(a) }));
  });

  test('fix', async () => {});
});
