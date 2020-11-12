import { SiteCrawler } from '../../core/site';
import { Post } from '../../core/post';
import { IPostParseConfig } from '../../core/site/normal';
import { initConfig } from '../../core';
import { MainConfig, SiteConfig } from '../../core/config';
import _ = require('lodash');

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
    return Promise.resolve(undefined);
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
  // await site.startFindLinks(, { poolSize: 1 });
  await site.startFetchPosts(cates, {
    poolSize: 1,
    fetchPostsQueryBuild(q) {
      q.must_not.push({
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
