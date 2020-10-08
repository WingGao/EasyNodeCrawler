import _ = require('lodash');
import bytes = require('bytes');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';
import { BtTorrent } from '../model';
import { getInt } from '../../../utils';

const Haidan = _.merge(new BtSiteBaseConfig(), {
  key: 'haidan',
  host: 'www.haidan.video',
  torrentPages: ['/torrents.php'],
  myUserId: '18473', //shaziniu
  pageStart0: true,
});

Haidan.doCheckin = async (site) => {
  await site.axiosInst.get(`/signin.php`);
  return true;
};

Haidan.parsePage = (site: BtCrawler, $: CheerioStatic, cateId?, html?: string) => {
  return (async () => {
    // 获取页数
    let $pages = $('.torrent_panel').siblings('p').find('a');
    let pageMax = 0;
    $pages.each((i, v) => {
      let g = /page=(\d+)/.exec(v.attribs.href);
      if (g == null) return;
      let page = parseInt(g[1]);
      if (!isNaN(page)) {
        pageMax = Math.max(pageMax, page);
      }
    });
    pageMax++;
    let posts = [];
    $('.torrent_panel .torrent_group').each((i, v) => {
      let $tr = $(v);

      // let $tds = $tr.find('>td');
      // let $tname = $tr.find('.torrentname');
      let $detail = $tr.find('.torrent_detail');
      let title = $tr.find('.video_name_str').text().trim();
      // let tits = tit.split('[')
      // if (tits.length > 1){
      //   torrent.ti
      // }else{
      // 目前不区分正副标题
      let isTop = $tr.find('.free_bg').length > 0 || $tr.find('.twoup_bg').length > 0;
      let parseItem = ($item) => {
        let torrent = new BtTorrent();
        torrent.site = site.btCnf.key;
        let $a = $item.find('.name_icon a').filter((j, x) => _.get(x.attribs, 'href', '').indexOf('download') >= 0);
        let tid = parseInt(/id=(\d+)/.exec($a.attr('href'))[1]);
        torrent.tid = tid;
        let tit2 = $item.find('.torrent_name_col a').text().trim();
        torrent.title = title + ' ' + tit2;
        let ctimeT = $item.find('.time_col span').attr('title');
        torrent.createTime = new Date(ctimeT);
        let sizeT = $item.find('.video_size').text().trim();
        torrent._fsizeH = sizeT;
        torrent.fsize = bytes(sizeT);
        let upNum = $item.find('.seeder_col').text().trim();
        torrent.upNum = getInt(upNum);
        torrent._isTop = isTop;
        torrent._isFree = $item.find('.pro_free').length > 0 || $item.find('.pro_free2up').length > 0;
        posts.push(torrent);
      };
      if ($detail.length == 0) {
        parseItem($tr);
      } else {
        //有group
        $detail.find('.torrent_item').each((j, ti) => {
          parseItem($(ti));
        });
      }
    });
    return { $: undefined, pageMax, posts };
  })();
};
//
export default Haidan;
