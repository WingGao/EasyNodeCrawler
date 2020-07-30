import { SiteCrawler } from './normal';
import axios from 'axios';
import * as iconv from 'iconv-lite';
import cheerio = require('cheerio');
import _ = require('lodash');
import { Post } from '../post';
import { getInt, toZhSimple } from '../utils';
import Redis from '../redis';

export class SiteCrawlerDiscuz extends SiteCrawler {
  // Discuz! X3.4
  async checkCookie() {
    let rep = await axios.get(this.config.fullUrl('/home.php'), {
      headers: this.config.getHeaders(),
      responseType: 'arraybuffer',
    });
    let data = iconv.decode(rep.data, 'gbk');
    let uid = /uid=(\d+)/.exec(data);
    if (uid && uid.length > 1) {
      return true;
    } else {
      throw new Error('cookie失效');
    }
  }

  /**
   * 获取板块
   */
  async listCategory() {
    // 通过我的权限来获取大概
    let rep = await this.axiosInst.get(
      this.config.fullUrl('/home.php?mod=spacecp&ac=usergroup&do=forum'),
    );
    let $ = cheerio.load(rep.data);
    let table = $('table');
    let blocks = [];
    table.find('tr').each((tri, tr) => {
      if (tri == 0) return; //跳过表头
      let $tr = $(tr);
      let $name = $tr.find('th');
      let href = $name.find('a').attr('href');
      let block = {
        id: null,
        name: $name.text(),
        canShow:
          _.defaultTo($($tr.find('td').get(0)).find('img').attr('alt'), '').indexOf('invalid') < 0,
      };
      let ids = /forum-(\d+)-(\d+)/.exec(href);
      let nameStyle = _.defaultTo($name.attr('style'), '');
      if (nameStyle.indexOf('padding-left') >= 0) {
        block.id = ids[1];
        blocks.push(block);
      }
      // debugger;
    });
    console.log(JSON.stringify(blocks));
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

  async fetchPage(pageUrl) {
    this.logger.info('获取', pageUrl);
    let rep = await this.axiosInst.get(pageUrl);
    let $ = cheerio.load(rep.data);
    if (!this.checkPermission($)) {
      //没有权限
      return;
    }
    let posts = [];
    for (let tbody of $('#threadlist #threadlisttableid tbody')) {
      let $tbody = $(tbody);
      // 排除置顶的
      let attId = $tbody.attr('id');
      let post = this.createPost();
      if (attId.indexOf('normalthread') >= 0) {
        post.id = getInt(attId).toString();
        post.url = `/forum.php?mod=viewthread&tid=${post.id}`;
        post.viewNum = parseInt($tbody.find('.num>em').text());
        post.replyNum = parseInt($tbody.find('.num>a').text());
        let $th = $tbody.find('th');
        post.canReply = $th.attr('class').indexOf('lock') < 0;
        post._lastReplyUser = $tbody.find('.by cite').text().trim();
        // 添加到队列
        posts.push(post);
      }
    }
    // 获取max
    let pageMax = 1;
    let spanT = $('#fd_page_top label span').text();
    if (spanT.length == 0 && posts.length > 0) {
      pageMax = 1;
    } else {
      let pageG = /(\d+)/.exec(spanT);
      pageMax = parseInt(pageG[1]);
    }
    return { posts, $, pageMax };
  }

  async fetchPages(cateId) {
    let pageMax = 1;
    for (let page = 1; page <= pageMax; page++) {
      // 按发帖时间
      let listUrl = this.config.fullUrl(
        `/forum.php?mod=forumdisplay&fid=${cateId}&orderby=dateline&page=${page}`,
      );
      let res = await this.fetchPage(listUrl);

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
}
