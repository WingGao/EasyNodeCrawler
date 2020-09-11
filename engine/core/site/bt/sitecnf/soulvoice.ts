import _ = require('lodash');
import { BtSiteBaseConfig } from './base';

const SoulVoice = _.merge(new BtSiteBaseConfig(), {
  key: 'soulvoice',
  host: 'pt.soulvoice.club',
  torrentPages: ['/torrents.php'], //电子书不分析了
  myUserId: '96892', //shaziniu
});
export default SoulVoice;
