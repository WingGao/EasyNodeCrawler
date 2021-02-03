import _ = require('lodash');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';
import { BtTorrent } from '../model';

const PTHome = _.merge(new BtSiteBaseConfig(), {
  key: 'pthome',
  host: 'pthome.net',
  torrentPages: ['/torrents.php'],
  myUserId: '122385', //shaziniu
  downloadThread: 1, //站点有限制
  downloadDelay: (3600 / 25) * 1000, //1小时30个
  // fetchFileMode: BtSiteBaseConfig.FETCH_MODE_TASK,
  parsePageTr(bt: BtCrawler, $: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) {
    bt.parsePageTr($, $tr, torrent);
    let $tbName = $tr.find('.torrentname > tbody > tr > td').eq(0);
    let $span = $tbName.find('> span').last();
    torrent.title2 = $span.text().trim();
    return;
  },
});
export default PTHome;
