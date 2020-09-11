import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const LeagueHD = _.merge(new BtSiteBaseConfig(), {
  key: 'leaguehd',
  host: 'leaguehd.com',
  torrentPages: ['/torrents.php', '/torrents.php?animate=yes'],
  myUserId: '26801', //shaziniu
});
export default LeagueHD;
