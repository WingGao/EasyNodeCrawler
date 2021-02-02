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
  pageResultCheck: 2,
  // parsePageNum: (bt: BtCrawler, $: CheerioStatic): number => {
  //     return 0
  // },
  parsePage(bt: BtCrawler, $: CheerioStatic, cateId?, html?: string): Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }> {
    if (cateId != '/torrents_movie.php') {
      return bt.parsePageNormal($, cateId, html);
    }
    return this.parsePageCombine(bt, $, cateId);
  },
  parsePageTr(bt: BtCrawler, $: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) {
    let $tds = $tr.find('>td');
    let $tname = $tr.find('.torrentname');
    this._parsePageTitle($tname, torrent);
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
  _parsePageTitle($td: Cheerio, torrent: BtTorrent) {
    let $a = $td.find('a').filter((j, x) => _.get(x.attribs, 'href', '').indexOf('details') >= 0);
    torrent.tid = parseInt(/id=(\d+)/.exec($a.attr('href'))[1]);
    torrent.title = $a.text().trim();
    if (torrent.title.length == 0) {
      // debugger;
    }
    $a.remove();

    let textList = $td.contents().filter((j, x) => x.type == 'text');
    let tit2Node = _.last(textList);
    if (tit2Node != null) {
      let tit2 = tit2Node.data.trim();
      if (tit2.length > 0) {
        torrent.title2 = tit2;
      }
    }
  },
  // 解析聚合的post
  parsePageCombine(bt: BtCrawler, $: CheerioStatic, cateId) {
    let isTop = false;
    let pageMax = bt.parsePageNumNormal($);
    let posts = [];
    let normalTitle = null;
    $('.torrents > tbody > tr').each((i, tr) => {
      if (i == 0) return;
      let $tr = $(tr);
      let $tds = $tr.find('>td');
      if ($tds.length >= 2) {
        let $td1 = $tds.eq(1);
        let td1Txt = $td1.text().trim();
        if (td1Txt == '官方置顶') {
          isTop = true;
        } else if (td1Txt == '置顶卡专区') {
          isTop = true;
        } else if ($tds.eq(0).attr('rowspan') == '3') {
          // 判断是否结束
          isTop = false;
          normalTitle = td1Txt;
        }
        if ($tds.length > 5) {
          //post
          let torrent = new BtTorrent();
          torrent.site = this.key;
          let $tdName = $tds.eq(2);
          this._parsePageTitle($tdName, torrent);
          // 副标题
          let baseIdx = 5;
          if (normalTitle == null) {
            let title2 = _.last($tdName.find('div'));
            torrent.title2 = $(title2).text().trim();
            baseIdx = 7;
          } else {
            torrent.title2 = normalTitle;
          }
          let ctimeT = $tds.eq(baseIdx).find('span').attr('title');
          torrent.createTime = new Date(ctimeT);
          let sizeT = $tds
            .eq(baseIdx + 1)
            .text()
            .trim();
          torrent._fsizeH = sizeT;
          torrent.fsize = bytes(sizeT);
          torrent.upNum = parseInt(
            $tds
              .eq(baseIdx + 2)
              .text()
              .trim(),
          );
          torrent._downloadNum = parseInt(
            $tds
              .eq(baseIdx + 3)
              .text()
              .trim(),
          );
          torrent._completeNum = parseInt(
            $tds
              .eq(baseIdx + 4)
              .text()
              .trim(),
          );
          torrent._isTop = isTop;
          torrent._isFree = $tdName.find('.pro_free').length > 0 || $tdName.find('.pro_free2up').length > 0;
          posts.push(torrent);
        }
      }
    });
    posts.sort((a, b) => b.tid - a.tid); //从大到小
    return Promise.resolve({ $: undefined, pageMax, posts });
  },
});
export default LeagueHD;
