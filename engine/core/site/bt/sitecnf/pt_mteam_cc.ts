import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const MTeamConfig = _.merge(new BtSiteBaseConfig(), {
  key: 'mteam',
  host: 'pt.m-team.cc',
  torrentPages: ['/torrents.php', '/music.php', '/adult.php'],
  myUserId: '217881',
  checkin: false,
});
export default MTeamConfig;
