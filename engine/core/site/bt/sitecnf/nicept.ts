import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const NicePt = _.merge(new BtSiteBaseConfig(), {
  key: 'nicept',
  host: 'www.nicept.net',
  torrentPages: ['/torrents.php'],
  myUserId: '107484', //shaziniu
});
export default NicePt;
