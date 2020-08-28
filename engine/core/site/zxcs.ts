import { IPostParseConfig, SiteCrawler } from './normal';
import { Post } from '../post';
import { SiteConfig } from '../config';
import cheerio = require('cheerio');
import _ = require('lodash');
import { initConfig } from '../index';
import ESClient from '../es';
import * as path from 'path';
import * as fs from 'fs';
import execa = require('execa');
import { execaCn } from '../utils';

class SiteZxcsCrawler extends SiteCrawler {
  constructor() {
    let c = new SiteConfig('www.zxcs.me');
    c.name = '知轩藏书';
    c.host = c.key;
    c.https = false;
    c.savePageResult = true;
    c.ex.categorys = [
      // { id: '23', name: '都市·娱乐' },
      // { id: '25', name: '武侠·仙侠' },
      // { id: '26', name: '奇幻·玄幻' },
      // { id: '27', name: '科幻·灵异' },
      // { id: '28', name: '历史·军事' },
      // { id: '29', name: '竞技·游戏' },
      // { id: '55', name: '二次元' },
      // { id: '36', name: '精校武侠' },
      // { id: '37', name: '精校仙侠' },
      // { id: '38', name: '精校奇幻' },
      // { id: '39', name: '精校玄幻' },
      { id: '40', name: '精校科幻' },
      { id: '41', name: '精校灵异' },
      { id: '42', name: '精校历史' },
      { id: '43', name: '精校军事' },
      { id: '44', name: '精校竞技' },
      { id: '45', name: '精校游戏' },
    ];

    super(c);
    this.ensureTempDir();
  }
  async checkCookie(): Promise<any> {
    return true;
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page?: number, ext?: string): string {
    return this.config.fullUrl(`/sort/${cateId}/page/${page}`);
  }

  getPostUrl(pid, page?: number): string {
    return this.config.fullUrl(`/post/${pid}`);
  }

  async listCategory() {
    let rep = await this.axiosInst.get(this.config.fullUrl('/map.html'));
    let $ = cheerio.load(rep.data);
    let cates = [];
    $('#sort li').each((i, li) => {
      let $a = $(li).find('a').eq(0);
      cates.push({
        id: _.last($a.attr('href').split('/')),
        name: $a.text().split('(')[0],
      });
    });
    return cates;
  }

  parsePage(
    $: CheerioStatic,
    cateId?,
    html?: string,
  ): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    let posts = [];
    $('#pleft > dl').each((i, dl) => {
      let $dl = $(dl);
      let p = this.newPost();
      let $dta = $dl.find('dt a');
      p.id = _.last($dta.attr('href').split('/'));
      p.title = $dta.text().trim();
      p.body = $dl.find('.des').text().trim();
      p.categoryId = cateId;
      posts.push(p);
    });
    let $page = $('#pagenavi a').last();
    let pageMax = parseInt(_.last($page.attr('href').split('/')));
    return Promise.resolve({ $: undefined, pageMax, posts });
  }

  async parsePost(post: Post, $, pcf?: IPostParseConfig): Promise<Post> {
    return Promise.resolve(undefined);
  }

  async sendPost(cp: Post, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }

  async sendReply(post: Post, text: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  async fetchDownloadLink(pid) {
    let rep = await this.axiosInst.get(this.config.fullUrl(`/download.php?id=${pid}`));
    const $ = cheerio.load(rep.data);
    const link = $('.panel-body .downfile a').eq(0).attr('href');
    return link;
  }

  // 下载书籍
  async downloadBook(p: Post) {
    this.logger.info(`downloadBook 下载 ${p.title} ${p.id}`);
    let dUrl = await this.fetchDownloadLink(p.id);
    let sname = this.getSearchName(p.title);
    let newFile = path.resolve(this.config.tempPath, `./${p.title}.txt`);
    if (fs.existsSync(newFile)) {
      this.logger.info(`downloadBook 已存在`);
      return newFile;
    }
    let rep = await this.axiosInst.get(dUrl, {
      responseType: 'stream',
      transformResponse: (d) => d,
    });
    let ext = _.last(dUrl.split('.'));
    let tmpFile = path.resolve(this.config.tempPath, `${p.id}.${ext}`); //rar文件
    let d = rep.data.pipe(fs.createWriteStream(tmpFile, { emitClose: true }));
    await new Promise((resolve) =>
      d.on('close', () => {
        resolve();
      }),
    );
    if (ext == 'rar') {
      //使用rar解压
      let rarTmp = path.resolve(this.config.tempPath, 'rar');
      if (!fs.existsSync(rarTmp)) fs.mkdirSync(rarTmp);
      let res = execaCn.commandSync(`WinRAR.exe x ${tmpFile} ${rarTmp}`);
      if (!res.failed) {
        let files = fs.readdirSync(rarTmp);
        let txtFile = _.find(files, (v) => v.indexOf(sname) >= 0);
        fs.renameSync(path.resolve(rarTmp, txtFile), newFile);
        fs.unlinkSync(tmpFile); //解压完后删除
      } else {
        debugger;
      }
    }
    this.logger.info('downloadBook 完成');
    return newFile;
  }

  getSearchName(tit: string) {
    return /《([^》]+)》/.exec(tit)[1];
  }
  // 找到不存在的书
  async findDiffWithSite(siteKey: string) {
    // 一本本找
    let p = new Post();
    let from = 0;
    let ok = true;
    let sz = 100;
    while (ok) {
      let rep = await ESClient.inst().search({
        // scroll: '1m',
        index: p.indexName(),
        size: sz,
        from,
        body: {
          query: {
            term: {
              site: this.config.key,
            },
          },
        },
      });
      if (rep.statusCode >= 200) {
        let sid = rep.body._scroll_id;
        for (let b of rep.body.hits.hits) {
          let np = this.newPost();
          _.merge(np, b._source);
          // 判断在不在
          let searchName = /《([^》]+)》/.exec(np.title)[1];
          from++;
          this.logger.info(`搜索`, searchName, from);
          let sRep = await ESClient.inst().search({
            index: p.indexName(),
            body: {
              query: {
                bool: {
                  must: [
                    {
                      term: {
                        site: siteKey,
                      },
                    },
                    {
                      match: {
                        title: {
                          query: searchName,
                          operator: 'and',
                        },
                      },
                    },
                  ],
                },
              },
            },
          });
          let hitLen = sRep.body.hits.hits.length;
          this.logger.info('命中', hitLen);
          if (hitLen == 0) {
            //可以发书
            let bookPath = await this.downloadBook(np);
            debugger;
          }
        }
        let clen = rep.body.hits.hits.length;
        ok = clen >= sz;
      } else {
        throw rep;
      }
    }
  }
}
export default SiteZxcsCrawler;

if (require.main === module) {
  (async () => {
    await initConfig('config/dev.yaml');
    let site = new SiteZxcsCrawler();
    // site.startFindLinks(site.config.ex.categorys);
    site.findDiffWithSite('www.abooky.com');
  })();
}
