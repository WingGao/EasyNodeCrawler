import _ = require('lodash');
import { BtSiteBaseConfig } from './base';
import { BtTorrent } from '../model';
import { BtCrawler } from '../index';
import { waitUntilLoad } from '../../../utils';

const MTeamConfig = _.merge(new BtSiteBaseConfig(), {
  key: 'mteam',
  host: 'pt.m-team.cc',
  torrentPages: ['/torrents.php', '/music.php', '/adult.php'],
  myUserId: '217881',
  checkCookie: async (bt: BtCrawler) => {
    //因为mteam的二级验证有问题，需要手动跳转
    let userUrl = bt.config.fullUrl('/usercp.php');
    let rep = await bt.axiosInst.get(userUrl);
    let falg = false;
    if (rep.request.path.indexOf('/verify.php') >= 0 && falg) {
      bt.config.selenium = true;
      let driver = await bt.getSelenium();
      await driver.get(userUrl);
      await waitUntilLoad(driver);
      // 判断cookie是否有效
      let html = await driver.getPageSource();
      // debugger;
      return bt.parseCheckCookie(html);
    }
    return bt.parseCheckCookie(rep.data);
  },
  checkin: false,
  watchRules: {
    av: (bt: BtTorrent) => {
      return (bt.title + ' ' + bt.title2).indexOf('楓カレン') >= 0;
    },
  },
  hotRate: [50, 80], //0=30分钟 1=1小时
});
export default MTeamConfig;
