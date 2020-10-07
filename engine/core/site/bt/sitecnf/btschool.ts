import _ = require('lodash');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';

const BtSchool = _.merge(new BtSiteBaseConfig(), {
  key: 'btschool',
  host: 'pt.btschool.club',
  torrentPages: ['/torrents.php'],
  myUserId: '64299', //shaziniu
  doCheckin: async (bt: BtCrawler) => {
    let rep = await bt.axiosInst.get('/index.php?action=addbonus');
    return true;
  },
});
export default BtSchool;
