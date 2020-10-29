import _ = require('lodash');
import { BtSiteBaseConfig } from './base';
import { BtTorrent } from '../model';

const MTeamConfig = _.merge(new BtSiteBaseConfig(), {
  key: 'mteam',
  host: 'pt.m-team.cc',
  torrentPages: ['/torrents.php', '/music.php', '/adult.php'],
  myUserId: '217881',
  checkin: false,
  watchRules: {
    av: (bt: BtTorrent) => {
      return (bt.title + ' ' + bt.title2).indexOf('楓カレン') >= 0;
    },
  },
  hotRate: [50, 80], //0=30分钟 1=1小时
});
export default MTeamConfig;
