import _ = require('lodash');
import bytes = require('bytes');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';
import { BtTorrent } from '../model';
import { getInt } from '../../../utils';
import { Post } from '../../../post';

const TjuPt = _.merge(new BtSiteBaseConfig(), {
  key: 'tjupt',
  host: 'www.tjupt.org',
  torrentPages: ['/torrents.php'],
  myUserId: '105572', //shaziniu
  checkin: false,
  // pageStart0: true,
});

TjuPt.parsePageTr = (bt: BtCrawler, $: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) => {
  //先按原逻辑处理
  bt.parsePageTr($, $tr, torrent);
};

export default TjuPt;
