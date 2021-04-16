import _ = require('lodash');
import bytes = require('bytes');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';
import { BtFieldType, BtTorrent } from '../model';

//柠檬
const LeagueHD = _.merge(new BtSiteBaseConfig(), {
  key: 'leaguehd',
  alias: ['lemonhd'],
  // 警告：目前已关闭游客访问，您可以通过 "login.php?passkey=您的passkey" 的方式随时登录！请设置好您的Cookies！
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
    // ['/torrents_movie.php', '/torrents_tv.php', '/torrents_mv.php', '/torrents_doc.php', '/torrents_other.php'].indexOf(cateId) < 0
    if (['/torrents_music.php'].indexOf(cateId) >= 0) {
      return bt.parsePageNormal($, cateId, html);
    }
    return this.parsePageCombine(bt, $, cateId);
  },
  // 普通,音乐
  parsePageTr(bt: BtCrawler, $: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) {
    let $tds = $tr.find('>td');
    let $tname = $tds.eq(2).find('div');
    this._parsePageTitle($tname.eq(0), torrent);
    // if (torrent.title.indexOf('7 Minutes') >= 0) {
    //   debugger;
    // }
    let timeIdx = 4;
    let ctimeT = $tds.eq(timeIdx).find('span').attr('title');
    torrent.createTime = new Date(ctimeT);
    let sizeT = $tds
      .eq(timeIdx + 1)
      .text()
      .trim();
    torrent._fsizeH = sizeT;
    torrent.fsize = bytes(sizeT);
    torrent.upNum = parseInt(
      $tds
        .eq(timeIdx + 2)
        .text()
        .trim(),
    );
    torrent._downloadNum = parseInt(
      $tds
        .eq(timeIdx + 3)
        .text()
        .trim(),
    );
    torrent._completeNum = parseInt(
      $tds
        .eq(timeIdx + 4)
        .text()
        .trim(),
    );
    torrent._isTop = $tname.find('img[alt=Sticky]').length > 0;
    torrent._isFree = $tname.find('.pro_free').length > 0 || $tname.find('.pro_free2up').length > 0;
  },
  _parsePageTitle($td: Cheerio, torrent: BtTorrent) {
    let $a = $td.find('a').filter((j, x) => _.get(x.attribs, 'href', '').indexOf('details') >= 0);
    torrent.tid = parseInt(/id=(\d+)/.exec($a.attr('href'))[1]);
    torrent.title = $a.text().trim();
    if (torrent.title.length == 0) {
      debugger;
    }
    // 标题在链接上
    let aTitle = $a.attr('title');
    if (aTitle != null) {
      torrent.title = aTitle.trim();
      return;
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
    let $pages = $('.torrents').siblings('div').find('a');
    let pageMax = bt.parsePageNumDivs($pages);
    let posts = [];
    let normalTitle = null; //普通标题
    let columns = [];
    let colBaseIdx = -1; //col偏移
    $('.torrents > tbody > tr').each((i, tr) => {
      let $tr = $(tr);
      let $tds = $tr.find('>td');
      if (i == 0) {
        // 自动匹配列内容
        $tds.each((j, td) => {
          let $td = $(td);
          let col = { type: BtFieldType.UNKNOWN };
          switch (j) {
            case 2:
              col.type = BtFieldType.TITLE;
              break;
            default:
              let $img = $td.find('img');
              if ($img.length > 0) {
                switch ($img.attr('class')) {
                  case 'time':
                    col.type = BtFieldType.CREATE_TIME;
                    break;
                  case 'size':
                    col.type = BtFieldType.SIZE;
                    break;
                  case 'seeders':
                    col.type = BtFieldType.SEEDERS;
                    break;
                  case 'leechers':
                    col.type = BtFieldType.LEECHERS;
                    break;
                  case 'snatched':
                    col.type = BtFieldType.COMPLETE;
                    break;
                }
              }
              break;
          }
          columns[j] = col;
        });
        return;
      }
      if ($tds.length >= 2) {
        let $td1 = $tds.eq(1);
        let td1Txt = $td1.text().trim();
        if (td1Txt == '官方置顶') {
          isTop = true;
        } else if (td1Txt == '置顶卡专区') {
          isTop = true;
        } else if (_.size($tds.eq(0).attr('rowspan')) > 0) {
          //普通封面图
          isTop = false;
          normalTitle = td1Txt;
        }

        if ($tds.length > 5) {
          //post
          let torrent = new BtTorrent();
          torrent.site = this.key;
          columns.forEach((col, colIdx) => {
            let $td = $tds.eq(colIdx + colBaseIdx);
            let tdTxt = $td.text().trim();
            switch (col.type) {
              case BtFieldType.TITLE:
                torrent._isFree = $td.find('.pro_free').length > 0 || $td.find('.pro_free2up').length > 0;
                if (tdTxt.indexOf('(免费剩余') >= 0) torrent._isFree = true;
                this._parsePageTitle($td, torrent);
                break;
              case BtFieldType.CREATE_TIME:
                let ctimeT = $td.find('span').attr('title');
                torrent.createTime = new Date(ctimeT);
                break;
              case BtFieldType.SIZE:
                torrent._fsizeH = tdTxt;
                torrent.fsize = bytes(tdTxt);
                break;
              case BtFieldType.SEEDERS:
                torrent.upNum = parseInt(tdTxt);
                break;
              case BtFieldType.LEECHERS:
                torrent._downloadNum = parseInt(tdTxt);
                break;
              case BtFieldType.COMPLETE:
                torrent._completeNum = parseInt(tdTxt);
                break;
              default:
                break;
            }
          });

          // 副标题

          if (normalTitle == null) {
            // 不处理副标题了
            // let title2 = _.last($tdName.find('div'));
            // torrent.title2 = $(title2).text().trim();
          } else {
            torrent.title2 = normalTitle;
          }

          torrent._isTop = isTop;

          posts.push(torrent);
        }
      } else if ($tds.length == 1) {
        // 普通分割
      }
    });
    posts.sort((a, b) => b.tid - a.tid); //从大到小
    return Promise.resolve({ $: undefined, pageMax, posts });
  },
});
export default LeagueHD;
