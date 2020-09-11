import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const PterClub = _.merge(new BtSiteBaseConfig(), {
  key: 'pterclub',
  host: 'pterclub.com',
  torrentPages: ['/torrents.php'],
  myUserId: '10421', //shaziniu
});
export default PterClub;
