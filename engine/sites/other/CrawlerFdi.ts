import { SiteCrawler } from '../../core/site';
import { Post } from '../../core/post';
import { IPostParseConfig } from '../../core/site/normal';
import { initConfig } from '../../core';
import { MainConfig, SiteConfig } from '../../core/config';
import _ = require('lodash');
import * as fs from 'fs';
import * as path from 'path';

class PostP extends Post {
  indexName(): string {
    return `${MainConfig.default().dataPrefix}post_fdi.gov.cn`;
  }
}

class CrawlerFdi extends SiteCrawler {
  async checkCookie(): Promise<any> {
    return Promise.resolve(undefined);
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page?: number, ext?: string): string {
    return (
      '/fdip_swb_xmkweb/business/controllers/xiangMuGuanLiAction/ZSYZList' +
      '?iproject=1&xiangMuFenLei=10250004&ichk=10200003&faBuZhuangTai=10230002&' +
      `page=${page}&rows=10`
    );
  }

  getPostUrl(pid, page?: number): string {
    return (
      '/fdip_swb_xmkweb/business/controllers/xiangMuGuanLiAction/xiangMuLook?' + `id=${pid}&iproject=1&userId=undefined`
    );
  }

  async parsePage(
    $: CheerioStatic,
    cateId?,
    html?: string,
  ): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    let result = JSON.parse(html);
    let pageMax = Math.floor(result.total / 10) + 1;
    let posts = _.map(result.rows, (row) => {
      return this.newPost({
        id: row.id,
        title: row.xiangMuMingCheng,
        bodyBin: JSON.stringify({
          iproject: row.iproject,
        }),
      });
    });
    return { $: undefined, pageMax, posts };
  }

  async parsePost(post: Post, $: CheerioStatic, pcf?: IPostParseConfig): Promise<Post> {
    post._ext = JSON.parse(post.bodyBin);
    let xiang_main = $('.xiang_main');
    let main_tits = xiang_main.find('.main_tits').first();
    main_tits.children().each((i, child) => {
      let $child = $(child);
      let $divs = $child.children('div');
      let key = $divs.eq(0).text().trim();
      let val = $divs.eq(1).text().trim();
      post._ext[key] = val;
    });
    post.body = 'done';
    post.bodyBin = JSON.stringify(post._ext);
    return post;
  }

  async sendPost(cp: Post, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }

  async sendReply(post: Post, text: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  newPost(b?): Post {
    return new PostP(
      _.merge(
        {
          site: this.config.key,
        },
        b,
      ),
    );
  }

  async toCSV() {
    const XLSX = require('xlsx');
    // let workbook = XLSX.cre('test.xlsx');
    // let f = fs.createWriteStream('H:\\temp\\fdi.csv');
    let head = [
      'id',
      '项目名称',
      '发布日期',
      '项目分类',
      '投资方式',
      '项目类型',
      '所属行业',
      '项目地点',
      '项目有效期',
      '项目资金类型',
      '项目总金额',
      '拟吸引投资总金额',
      '项目内容描述',
      '项目标记',
    ];
    let rows = [head];
    await this.newPost().scrollSearch(
      {
        exists: {
          field: 'body',
        },
      },
      async (p, pg) => {
        let ex = JSON.parse(p.bodyBin);
        let row = _.map(head, (v, k) => {
          if (k == 0) return p.id;
          return ex[v];
        });
        rows.push(row);
        this.logger.info(`处理 ${p.id} ${pg.fmt()}`);
      },
    );
    let sheet = XLSX.utils.aoa_to_sheet(rows);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'default');
    XLSX.writeFile(wb, 'H:\\temp\\fdi.xlsb');
  }
}

async function main() {
  await initConfig();
  let cnf = new SiteConfig('fdi', {
    host: 'project.fdi.gov.cn',
    https: false,
    name: 'fdi',
    pageResultSave: true,
  });
  let site = new CrawlerFdi(cnf);
  await site.init();
  await new PostP().ensureIndex();
  let cates = [{ id: 1 }];
  // await site.startFindLinks(cates, { poolSize: 1 });
  // return;
  return await site.toCSV();
  await site.startFetchPosts(cates, {
    poolSize: 1,
    fetchPostsQueryBuild(q) {
      q.bool.must_not.push({
        exists: {
          field: 'body',
        },
      });
      return q;
    },
  });
}

if (require.main === module) {
  main();
}
