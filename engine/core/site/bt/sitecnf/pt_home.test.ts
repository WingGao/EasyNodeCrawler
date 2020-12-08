import { MainConfig } from '../../../config';
import { initConfig } from '../../../index';
import Pt_home from './pt_home';
import { BtCrawler } from '../index';
import { BtTorrent } from '../model';
let site: BtCrawler;
beforeAll(async () => {
  if (MainConfig.default() == null) {
    await initConfig();
  }
  site = new BtCrawler(Pt_home);
  await site.init();
  jest.setTimeout(30 * 60 * 1000);
});
describe('bt-pthome', () => {
  test('post', async () => {
    let p1 = await site.fetchPost(new BtTorrent({ tid: 80721, site: Pt_home.key }) as any);
    let p2 = await site.fetchPost(new BtTorrent({ tid: 83947, site: Pt_home.key }) as any);
    console.log(p1, p2);
  });
});
