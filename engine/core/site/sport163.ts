//网易新闻
import numeral = require('numeral');
import { SiteCrawler } from './normal';
import { MainConfig, SiteConfig } from '../config';
import { Post } from '../post';
import _ = require('lodash');
import iconv = require('iconv-lite');
import { AxiosRequestConfig } from 'axios';

class SiteSport163 extends SiteCrawler {
  constructor() {
    let c = new SiteConfig();
    c.host = 'sports.163.com';
    c.https = true;
    super(c);
  }
  async checkCookie(): Promise<any> {
    return true;
  }

  checkPermission($): boolean {
    return true;
  }

  getPostListUrl(cateId, page?: number, ext?: string): string {
    return this.config.fullUrl(
      `/special/000587PQ/newsdata_allsports_index${
        page > 1 ? '_' + numeral(page).format('00') : ''
      }.js?callback=data_callback`,
    );
  }

  getPostUrl(pid, page?: number): string {
    return '';
  }

  async fetchPage(
    pageUrl,
    cateId?,
    cnf?: { axConfig?: any },
  ): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    this.logger.info('获取', pageUrl);
    let rep = await this.axiosInst.get(pageUrl, {
      transformResponse: (data) => iconv.decode(data, 'gbk'),
    });
    let res = await this.parsePage(null, cateId, rep.data);
    // 排除黑名单
    res.posts = _.filter(res.posts, (v) => this.config.postBlacklist.indexOf(v.id) < 0);
    return res;
  }

  async parsePage(
    $: CheerioStatic,
    cateId?,
    html?,
  ): Promise<{ posts: Array<Post>; $: CheerioStatic; pageMax: number }> {
    let f = new Function(`
    var data_callback = (items)=>items;
    return ${html}
    `);
    let items = f();
    let posts: Array<Post> = [];
    items.forEach((v) => {
      if (v.newstype != 'article') return; //只处理文章
      let p = this.createPost();
      let urls = v.docurl.split('/') as string[];
      p.id = _.last(urls).split('.')[0];
      p.title = v.title;
      p.createTime = new Date(v.time);
      p.url = v.docurl;
      p._ext = { commenturl: v.commenturl };
      if (_.size(v.imgurl) > 0) {
        p._imgs = [v.imgurl];
      }
      posts.push(p);
    });
    return { posts, $: null, pageMax: 9 };
  }

  async parsePost(post: Post, $, pcf?): Promise<Post> {
    let $body = $('#endText');
    $body.find('.ep-source').remove();
    post.body = $body.text().trim();
    if (pcf.onlyMain === false) {
      //获取回复
      let t = new Date().getTime();
      let jname = `jsonp_${t}`;

      let rep = await this.axiosInst.get(
        `http://comment.api.163.com/api/v1/products/a2869674571f77b5a0867c3d71db5856/threads/${post.id}/comments/hotList` +
          `?ibc=newspc&limit=5&showLevelThreshold=72&headLimit=1&tailLimit=2&offset=0&callback=${jname}&_=${t}`,
      );
      let f = new Function(`
    var ${jname} = (items)=>items;
    return ${rep.data}
    `);
      let repd = f();
      post._replyList = [];
      _.forEach(repd.commentIds, (ids) => {
        _.forEach(ids.split(','), (cid) => {
          let v = repd.comments[cid];
          let p = new Post();
          p.id = v.commentId;
          p.body = v.content;
          p.createTime = new Date(v.createTime);
          p.authorId = v.user.nickname;
          p.viewNum = v.vote;
          post._replyList.push(p);
        });
      });
    }
    return post;
  }

  async sendReply(post: Post, text: string): Promise<any> {
    return Promise.resolve(undefined);
  }

  async startFindLinks(): Promise<any> {
    return Promise.resolve(undefined);
  }

  async sendPost(cp, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }
}
export default SiteSport163;
