import _ = require('lodash');
import bytes = require('bytes');
import { BtSiteBaseConfig } from './base';
import { BtCrawler } from '../index';
import { BtTorrent } from '../model';
import { getInt } from '../../../utils';
import { Post } from '../../../post';

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
      let isTop = $tr.find('.sticky_flag').length > 0;
      let parseItem = ($item) => {
        let torrent = new BtTorrent();
        torrent.site = site.btCnf.key;
        // 通过详情链接判断
        // details.php?group_id=12992&torrent_id=12519
        let $a = $item
          .find('.torrent_name_col.torrent_cell a')
          .filter((j, x) => _.get(x.attribs, 'href', '').indexOf('torrent_id') >= 0);
        let tid = parseInt(/torrent_id=(\d+)/.exec($a.attr('href'))[1]);
        torrent.tid = tid;
        let tit2 = $item.find('.torrent_name_col a').text().trim();
        torrent.title = title + ' ' + tit2;
        let ctimeT = $item.find('.time_col span').last().attr('title');
        torrent.createTime = new Date(ctimeT);
        let sizeT = $item.find('.video_size').text().trim();
        torrent._fsizeH = sizeT;
        torrent.fsize = bytes(sizeT);
        let upNum = $item.find('.seeder_col').text().trim();
        torrent.upNum = getInt(upNum);
        torrent._downloadNum = getInt($item.find('.leecher_col').text());
        torrent._completeNum = getInt($item.find('.snatched_col').text());
        torrent._isTop = isTop;
        torrent._isFree = $item.find('.pro_free').length > 0 || $item.find('.pro_free2up').length > 0;
        posts.push(torrent);
        return torrent;
      };
      if ($detail.length == 0) {
        parseItem($tr);
      } else {
        //有group
        let maxId = 0;
        let group = [] as Array<BtTorrent>;
        $detail.find('.torrent_item').each((j, ti) => {
          let torr = parseItem($(ti));
          if (torr.tid > maxId) maxId = torr.tid;
          group.push(torr);
        });
        for (let torr of group) {
          //标记group里的旧项
          if (torr.tid < maxId) torr._ignoreOld = true;
        }
      }
    });
    return { $: undefined, pageMax, posts };
  })();
};
//
export default Haidan;
