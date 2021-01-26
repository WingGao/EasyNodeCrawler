import _ = require('lodash');
import bytes = require('bytes');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';
import { BtTorrent } from '../model';

//柠檬
const LeagueHD = _.merge(new BtSiteBaseConfig(), {
  key: 'leaguehd',
  alias: ['lemonhd'],
  // host: 'leaguehd.com', 2020年12月15日10:47:25
  host: 'lemonhd.org',
  torrentPages: [
    //2020年11月16日11:09:29 改版了
    '/torrents_movie.php',
    '/torrents_tv.php',
    '/torrents_music.php',
    '/torrents_animate.php',
    '/torrents_mv.php',
    '/torrents_doc.php',
    '/torrents_other.php',
  ],
  myUserId: '26801', //shaziniu
  // parsePageNum: (bt: BtCrawler, $: CheerioStatic): number => {
  //     return 0
  // },
  parsePageTr(bt: BtCrawler, $: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) {
    let $tds = $tr.find('>td');
    let $tname = $tr.find('.torrentname');
    let $a = $tname.find('a').filter((j, x) => _.get(x.attribs, 'href', '').indexOf('details') >= 0);
    torrent.tid = parseInt(/id=(\d+)/.exec($a.attr('href'))[1]);
    torrent.title = $a.text().trim();
    if (torrent.title.length == 0) {
      // debugger;
    }
    let $tdName = $a.closest('td');
    $a.remove();
    let textList = $tdName.contents().filter((j, x) => x.type == 'text');
    let tit2Node = _.last(textList);
    if (tit2Node != null) {
      let tit2 = tit2Node.data.trim();
      if (tit2.length > 0) {
        torrent.title2 = tit2;
      }
    }
    // if (torrent.title.indexOf('7 Minutes') >= 0) {
    //   debugger;
    // }

    let ctimeT = $tds.eq(3).find('span').attr('title');
    torrent.createTime = new Date(ctimeT);
    let sizeT = $tds.eq(4).text().trim();
    torrent._fsizeH = sizeT;
    torrent.fsize = bytes(sizeT);
    torrent.upNum = parseInt($tds.eq(5).text().trim());
    torrent._downloadNum = parseInt($tds.eq(6).text().trim());
    torrent._completeNum = parseInt($tds.eq(7).text().trim());
    torrent._isTop = $tname.find('img[alt=Sticky]').length > 0;
    torrent._isFree = $tname.find('.pro_free').length > 0 || $tname.find('.pro_free2up').length > 0;
  },
});
export default LeagueHD;
