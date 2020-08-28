import { SiteCrawler } from './normal';
import axios from 'axios';
import * as iconv from 'iconv-lite';
import cheerio = require('cheerio');
import _ = require('lodash');
import { Post } from '../post';
import { getInt, sleep, toFormData, toZhSimple, waitUntilLoad } from '../utils';
import Redis from '../redis';
import { By } from 'selenium-webdriver';
import FormData = require('form-data');

export class SiteCrawlerPhpwind extends SiteCrawler {
  async checkCookie() {
    let rep = await this.axiosInst.get(this.config.fullUrl('/profile.php'));
    let uid = /uid-(\d+)/.exec(rep.data);
    if (uid && uid[1] == this.config.myUserId) {
      return true;
    } else {
      throw new Error('cookie失效');
    }
  }

  /**
   * 获取板块
   */
  async listCategory() {
    // 通过wap页面来解析
    let rep = await this.axiosInst.get(this.config.fullUrl('/index.php'));
    let $ = cheerio.load(rep.data);
    let blocks = [];
    $('tr.tr3.f_one').each((tri, tr) => {
      let id = tr.attribs.id;
      if (id && id.indexOf('fid_') >= 0) {
        let $tr = $(tr);
        let $th = $tr.find('th').eq(0);
        $th.find('a').each((ai, a) => {
          let $a = $(a);
          let href = a.attribs.href;
          if (href && href.indexOf('fid-') > 0) {
            let cate = {} as any;
            cate.id = /fid-(\d+)/.exec(href)[1];
            cate.name = $a.text();
            blocks.push(cate);
          }
        });
      }
    });
    console.log(JSON.stringify(blocks));
    return blocks;
  }

  checkPermission($) {
    //todo
    return true;
  }

  async parsePage($, cateId) {
    let posts = [] as Array<Post>;
    for (let tbody of $('#ajaxtable .tr3.t_one') as any) {
      let $tbody = $(tbody);
      let $tds = $tbody.find('td');
      // 排除置顶的
      let $ta = $tds.eq(1).find('h3 a');
      let post = this.newPost();
      post.canReply = true;
      post.categoryId = cateId;
      let isGlobalTop = false; //是否是全局置顶
      $tbody.find('img').each((i, img) => {
        if (img.attribs.src.indexOf('headtopic_3.gif') > 0) {
          isGlobalTop = true;
        } else if (img.attribs.src.indexOf('topiclock.gif') > 0) {
          post.canReply = false;
        }
      });

      if (!isGlobalTop && $ta.length > 0) {
        post.id = getInt($ta.attr('id')).toString();
        post.url = `/read.php?tid-${post.id}.html`;
        post.title = $ta.text().trim();
        let replyStr = $tds.eq(3).text().split('/');
        post.replyNum = parseInt(replyStr[0]);
        post.viewNum = parseInt(replyStr[1]);
        post.authorId = parseInt($tds.eq(2).find('a').attr('href').split('uid-')[1]).toString();
        post._lastReplyUser = { uname: $tds.eq(4).find('span').text().split(':')[1].trim() };
        // 添加到队列
        posts.push(post);
      }
    }
    // 获取max
    let pageMax = 1;
    let spanT = $('.pagesone').eq(0).text();
    let pageG = /(\d+)/.exec(spanT.split('/')[1]);
    pageMax = parseInt(pageG[1]);
    return { posts, $, pageMax };
  }

  async fetchPages(cateId) {
    let pageMax = 1;
    for (let page = 1; page <= pageMax; page++) {
      // 按发帖时间
      let listUrl = this.config.fullUrl(`/forum.php?mod=forumdisplay&fid=${cateId}&orderby=dateline&page=${page}`);
      let res = await this.fetchPage(listUrl, cateId);

      if (res == null) {
        //没有权限
        continue;
      }

      let ps: any = res.posts.map((v) => {
        return this.queueAddPost(v);
      });

      if (page == 1) {
        pageMax = res.pageMax;
        this.logger.info('最大', pageMax);
      }
      this.logger.info('添加任务', ps.length);
      await Promise.all(ps);
    }
  }

  async startFindLinks(): Promise<any> {
    for (let cate of this.config.ex.categorys) {
      this.logger.info('处理', cate.name);
      await this.fetchPages(cate.id);
    }
    this.logger.info('获取post链接完毕');
  }
  // 专门解析post
  async parsePost(post: Post, $, pcf) {
    if (!this.checkPermission($)) {
      //没有权限
      return;
    }
    pcf = _.merge(
      {
        onlyMain: true, //只处理楼主
      },
      pcf,
    );
    let foundMain = false;

    post.site = this.config.key;
    // post.viewNum = parseInt($(v1).text());
    // post.replyNum = parseInt($(sps.get(4)).text());
    post._currentPage = parseInt($('.pages li b').text());
    // if (post.title == null) {
    //   post.title = $('#thread_subject').text().trim();
    // }
    // if (post.categoryId == null) {
    //   //获取目录
    //   let as = $('#pt a');
    //   let ca = as.get(as.length - 2);
    //   let cah = ca.attribs.href;
    //   if (cah.indexOf('forum') >= 0) {
    //     post.categoryId = getInt(cah).toString();
    //   } else {
    //     throw new Error('未处理' + cah);
    //   }
    // }
    let replyList = [];
    let $posts = $('div.t5.t2 > table');
    $posts.each((pi, p) => {
      if (foundMain && pcf.onlyMain) return; //只处理楼主
      let $p = $(p);
      let reply = new Post();

      reply.authorId = /uid-(\d+)/.exec($p.find('.user-pic a').attr('href'))[1];
      let $tit = $p.find('#td_tpc');
      let createDate = $tit.find('span').eq(1).text();
      reply.createTime = new Date(createDate);
      reply.updateTime = reply.createTime;
      let $body = $p.find('.tpc_content > div').filter((i, el) => el.attribs.id && el.attribs.id.indexOf('read') == 0);
      if (!foundMain) foundMain = $body.attr('id') == 'read_tpc';
      reply.bodyBin = $body.html().trim();
      $body.find('br').replaceWith('\n');
      reply.body = $body.text().trim();
      replyList.push(reply);
    });
    if (foundMain) {
      post = _.merge(post, replyList[0]);
    }

    if (this.config.toZh) {
      post.title = await toZhSimple(post.title);
      post.body = await toZhSimple(post.body);
    }
    post.encodeBody(this.config.saveBody);
    post._replyList = replyList;
    return post;
  }

  async sendReply(post: Post, text: string): Promise<any> {
    this.logger.info('准备回复', this.config.fullUrl(post.url), text);
    let purl = this.config.fullUrl(`/post.php?action-reply-fid-${post.categoryId}-tid-${post.id}.html`);
    let rep = await this.axiosInst.get(purl);
    let $ = cheerio.load(rep.data);
    let $form = $(`form`).filter((i, el) => {
      return el.attribs.action.indexOf('post.php') >= 0;
    });
    let fdo = await this.getFormData($form);
    fdo['atc_title'] = fdo['atc_title'].substr(0, 90);
    fdo['atc_content'] = text;
    let formData = toFormData(fdo);
    let res = await this.axiosInst.post(this.config.fullUrl(`/post.php`), formData, {
      headers: formData.getHeaders(),
    });
    $ = cheerio.load(res.data);
    let msg = $('center').text();
    this.logger.info('回复结束', post.id, msg);
    if (msg.indexOf('发帖完毕') > 0) return true;
    throw new Error(msg);
  }

  getPostUrl(pid, page = 1): string {
    return this.config.fullUrl(`/read.php?tid-${pid}-page-${page}.html`);
  }

  getPostListUrl(cateId, page): string {
    return this.config.fullUrl(`/thread.php?fid=${cateId}&page=${page}`);
  }

  async sendPost(cp, ext?: any): Promise<boolean> {
    return Promise.resolve(false);
  }
}
