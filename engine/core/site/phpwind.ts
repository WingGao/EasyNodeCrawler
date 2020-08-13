import { SiteCrawler } from './normal';
import axios from 'axios';
import * as iconv from 'iconv-lite';
import cheerio = require('cheerio');
import _ = require('lodash');
import { Post } from '../post';
import { getInt, sleep, toZhSimple, waitUntilLoad } from '../utils';
import Redis from '../redis';
import { By } from 'selenium-webdriver';

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
    let $alert = $('#messagetext');
    if ($alert.length > 0) {
      let msg = $alert.text().trim();
      this.logger.error(msg);
      if (/(权限)|(需要升级)/.test(msg)) {
      } else {
        throw new Error(msg);
      }
      return false;
    } else {
      return true;
    }
  }

  async fetchPage(pageUrl, cateId) {
    this.logger.info('获取', pageUrl);
    let rep = await this.axiosInst.get(pageUrl);
    let $ = cheerio.load(rep.data);
    if (!this.checkPermission($)) {
      //没有权限
      return;
    }
    let posts = [];
    for (let tbody of $('#ajaxtable .tr3.t_one') as any) {
      let $tbody = $(tbody);
      let $tds = $tbody.find('td');
      // 排除置顶的
      let $ta = $tds.eq(1).find('h3 a');
      let post = this.createPost();
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
      let listUrl = this.config.fullUrl(
        `/forum.php?mod=forumdisplay&fid=${cateId}&orderby=dateline&page=${page}`,
      );
      let res = await this.fetchPage(listUrl, cateId);

      if (res == null) {
        //没有权限
        continue;
      }

      let ps = res.posts.map((v) => {
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

  //将楼层转换为数字
  parseInnerId(str: string) {
    switch (str) {
      case '楼主':
        return 1;
      case '沙发':
        return 2;
      case '板凳':
        return 3;
      case '地板':
        return 4;
      default:
        return parseInt(str);
    }
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
    let found = false;
    let $tds = $($('#postlist > table').get(0)).find('td');
    post.site = this.config.host;
    // 查看: 547|回复: 294
    let sps = $($tds.get(0)).find('span');
    let v1 = sps.get(1);
    post.viewNum = parseInt($(v1).text());
    post.replyNum = parseInt($(sps.get(4)).text());
    post._currentPage = parseInt($('#pgt strong').text());
    post.canReply = $('#post_reply').length > 0;
    if (post.title == null) {
      post.title = $('#thread_subject').text().trim();
    }
    if (post.categoryId == null) {
      //获取目录
      let as = $('#pt a');
      let ca = as.get(as.length - 2);
      let cah = ca.attribs.href;
      if (cah.indexOf('forum') >= 0) {
        post.categoryId = getInt(cah).toString();
      } else {
        throw new Error('未处理' + cah);
      }
    }
    let replyList = [];
    $('#postlist > div').each((pi, p) => {
      if (found && pcf.onlyMain) return; //只处理楼主
      let $p = $(p);
      if ($p.attr('id').indexOf('post_') >= 0) {
        let pid = getInt($p.attr('id'));
        // 处理作者
        let $author = $p.find('.favatar .authi a');
        let reply = new Post();
        reply.authorId = /uid=(\d+)/.exec($author.attr('href'))[1];
        // 创建时间
        let createDate = $p.find(`#authorposton${pid}`).text().split('于')[1];
        reply.createTime = new Date(createDate);
        reply.updateTime = post.createTime;
        reply._innerId = this.parseInnerId($p.find(`#postnum${pid}`).text().trim());
        // 正文
        let $body = $(`#postmessage_${pid}`);
        reply.body = $body.text().trim();
        reply.bodyBin = $body.html().trim();

        // 更新时间
        $p.find('.pstatus').each((psi, ps) => {
          let pst = $(ps).text();
          if (pst.indexOf('本帖最后由') >= 0) {
            let ud = /(\d{4}-\d+-\d+ \d+:\d+)/.exec(pst)[1];
            reply.updateTime = new Date(ud);
          }
        });
        found = true;
        replyList.push(reply);
      }
    });
    if (found) {
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

  async createReply(post: Post, text: string): Promise<any> {
    await this.checkCookie();
    let driver = await this.getSelenium();
    await sleep(60000);
    await driver.get(this.config.fullUrl(`/profile.php`));
    return;
    await driver.get(
      this.config.fullUrl(`/post.php?action-reply-fid-${post.categoryId}-tid-${post.id}.html`),
    );
    await waitUntilLoad(driver);
    let textDom = await driver.findElement(By.id('textarea'));
    await textDom.sendKeys(text);
    let submit = await driver.findElement(By.css('input[type=submit]'));
    await submit.click();
    await waitUntilLoad(driver);
  }

  getPostUrl(pid): String {
    return this.config.fullUrl(`/read.php?tid-${pid}.html`);
  }
}
