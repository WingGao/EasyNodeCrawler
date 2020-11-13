import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const PTHome = _.merge(new BtSiteBaseConfig(), {
  key: 'pthome',
  host: 'pthome.net',
  torrentPages: ['/torrents.php'],
  myUserId: '122385', //shaziniu
  downloadThread: 1, //站点有限制
  downloadDelay: (3600 / 28) * 1000, //1小时30个
  fetchFileMode: BtSiteBaseConfig.FETCH_MODE_TASK,
});
export default PTHome;
