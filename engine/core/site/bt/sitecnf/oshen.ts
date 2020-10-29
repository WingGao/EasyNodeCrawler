import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const OshenPT = _.merge(new BtSiteBaseConfig(), {
  key: 'oshen',
  host: 'www.oshen.win',
  torrentPages: ['/torrents.php'],
  myUserId: '3886', //shaziniu
  checkin: false,
});
export default OshenPT;
