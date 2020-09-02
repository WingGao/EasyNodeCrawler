import { MainConfig, SiteConfig } from '../../config';
import { SiteCrawlerDiscuz } from '../discuz';
import { initConfig } from '../../index';
import SiteShuyue from '../../../sites/SiteShuyue';
import MTeamConfig from './sitecnf/pt_mteam_cc';
import { BtCrawler } from './index';
import { BtSiteBaseConfig } from './sitecnf/base';
import { Post } from '../../post';
import { BtSubItem, BtTorrent } from './model';

let testConfig: BtSiteBaseConfig;
let site: BtCrawler;
beforeAll(async () => {
  if (MainConfig.default() == null) {
    await initConfig();
  }
  testConfig = MTeamConfig;
  site = new BtCrawler(testConfig);
  jest.setTimeout(3 * 60 * 1000);
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
});
