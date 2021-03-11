import { SiteCrawler } from '../../core/site';
import { Post } from '../../core/post';
import { IPostParseConfig } from '../../core/site/normal';
import { initConfig } from '../../core';
import { MainConfig, SiteConfig } from '../../core/config';
import _ = require('lodash');
import * as fs from 'fs';
import * as path from 'path';
import * as qs from 'qs';
/**
 * 爱书音 电子书
 * https://www.ishuyin.com/show-23948.html
 */
class PostP extends Post {
  indexName(): string {
    return `${MainConfig.default().dataPrefix}post_fdi.gov.cn`;
  }
}

class CrawlerMy extends SiteCrawler {
  async checkCookie(): Promise<any> {
    return Promise.resolve(undefined);
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page?: number, ext?: string): string {
    return `/show-${cateId}.html`;
  }

  getPostUrl(pid, page?: number): string {
    if (pid.startsWith('player.php')) {
      // 'player.php?mov_id=23948&look_id=1&player=mp'
      return `/` + pid;
    }
  }

  async parsePage($: CheerioStatic, cateId?, html?: string): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    $('#articleDiv .box a').each((i, aDom) => {
      let $a = $(aDom);
      audioPageUrls.push($a.attr('href'));
    });

    return { $: undefined, pageMax: 1, posts: [] };
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

  async downloadAudio(playerUrl) {
    // player.php?mov_id=23948&look_id=1&player=mp
    let params = qs.parse(playerUrl.split('?')[1]);
    //https://mp3.aikeu.com/23948/1.mp3
    let mp3Url = `https://mp3.aikeu.com/${params['mov_id']}/${params['look_id']}.mp3`;
    await this.download(mp3Url);
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

let audioPageUrls = [];

async function main() {
  await initConfig();
  let cnf = new SiteConfig('ishuyin', {
    host: 'www.ishuyin.com',
    https: true,
    name: 'ishuyin',
    pageResultSave: false,
    tempPath: path.resolve(__dirname, '../../../temp/ishuyin'),
  });
  let site = new CrawlerMy(cnf);
  await site.init();
  let bookUrl = 'https://www.ishuyin.com/show-23948.html';
  let re = /show-(\d+)/;
  await site.startFindLinks([{ id: re.exec(bookUrl)[1] }], {
    poolSize: 1,
  });

  // audioPageUrls = ['player.php?mov_id=23948&look_id=1&player=mp'];
  for (let url of audioPageUrls) {
    await site.downloadAudio(url);
  }
}

if (require.main === module) {
  main();
}
