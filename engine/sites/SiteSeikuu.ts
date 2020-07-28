/**
 * https://bbs2.seikuu.com/
 */
import { SiteConfig, SiteType } from '../core/config';
import { initConfig } from '../core';
import { SiteCrawlerDiscuz } from '../core/site';
import { Post } from '../core/post';
import cookies from './cookie';

export default function getConfig() {
  let sc = new SiteConfig();
  sc.name = '星空论坛';
  sc.host = 'bbs2.seikuu.com';
  sc.siteType = SiteType.Discuz; //Discuz! X3.4
  sc.toZh = true;
  sc.saveBody = 2;
  sc.getHeaders = () => {
    return {
      cookie: cookies[sc.host].cookie,
    };
  };
  sc.beforeReq = (options, done) => {
    done();
  };
  sc.crawler = {
    maxConnections: 2,
  };
  //要爬取的板块
  sc.ex.categorys = [
    { id: '85', name: '日式游戏综合讨论专区', canShow: true },
    { id: '112', name: '日式游戏汉化发布专区', canShow: true },
    { id: '15', name: '日式游戏汉化综合讨论专区', canShow: true },
    {
      id: '103',
      name: '大图书馆的牧羊人 + 秽翼的尤斯蒂娅 + 东月西阳',
      canShow: true,
    },
    {
      id: '19',
      name: '战国恋姬 + 天下御免 + 恋姬无双 + 春恋乙女',
      canShow: true,
    },
    { id: '65', name: 'Berry’s + 妹之形 + 缘之空 + 悠之空', canShow: true },
    { id: '89', name: 'BALDR SKY + 青空下的约定 + V.G.NEO', canShow: true },
    {
      id: '76',
      name: '君与彼女与彼女之恋 + 装甲鬼村正 + 尘骸魔京',
      canShow: true,
    },
    {
      id: '107',
      name: '空を仰ぎて雲たかく + Chaos Labyrinth + 出云战记',
      canShow: true,
    },
    {
      id: '110',
      name: '红线 + 青城 + 爱神餐馆 + Forget Me Not',
      canShow: true,
    },
    {
      id: '79',
      name: '背德病栋 + 猎影之狼 + 我是主人公 + 人工学园',
      canShow: true,
    },
    { id: '67', name: '小说资源专区', canShow: true },
    { id: '60', name: '日式游戏资源专区', canShow: false },
    { id: '32', name: '表·漫画资源专区', canShow: true },
    { id: '35', name: '表·漫画资源原创专区', canShow: true },
    { id: '52', name: '里·漫画资源专区', canShow: false },
    { id: '33', name: '表·动画资源专区', canShow: true },
    { id: '37', name: '表·动画资源原创专区', canShow: true }, //需要35积分
    { id: '53', name: '里·动画资源专区', canShow: false },
    { id: '29', name: '萌の博物馆', canShow: true },
    { id: '98', name: '萌の博物馆原创专区', canShow: true },
    { id: '127', name: '欧美游戏专区', canShow: false },
    { id: '124', name: '大帝国汉化组', canShow: false },
    { id: '120', name: '欧美转载资源', canShow: false },
    { id: '66', name: '命の旅团工作室', canShow: true },
    { id: '114', name: '夜桜字幕组', canShow: true },
    { id: '100', name: '1CH 汉化组', canShow: true },
    { id: '109', name: '2DJ 汉化组', canShow: true },
    // { "id": "117", "name": "灰色汉化组", "canShow": false },
  ];
  return sc;
}

if (require.main === module) {
  (async () => {
    await initConfig('config/dev.yaml');
    let site = new SiteCrawlerDiscuz(getConfig());
    // await site.checkCookie();
    // await site.listCategory();
    // site.start();
    // await site.fetchPage(site.config.ex.categorys[0].id);
    // await site.startFindLinks();
    //
    let post = new Post();
    // post.site = site.config.host;
    // post.id = '241331';
    // post.url = '/forum.php?mod=viewthread&tid=241331';
    // //繁体
    post.id = '239842';
    post.url = '/forum.php?mod=viewthread&tid=239842';
    await site.fetchPost(post);
    // site.startWorker();
  })();
}
