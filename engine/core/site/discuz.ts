import { IPostParseConfig, SiteCrawler } from './normal';
import * as iconv from 'iconv-lite';
import cheerio = require('cheerio');
import _ = require('lodash');
import { Post } from '../post';
import { getInt, runSafe, sleep, toZhSimple } from '../utils';
import FormData = require('form-data');
import qs = require('qs');
import urlencode = require('urlencode');
import { randomCnIP } from '../utils/net';
import CheckinHandler from '../model/CheckinHandler';
import { AxiosInstance } from 'axios';
import any = jasmine.any;
export class SiteCrawlerDiscuz extends SiteCrawler {
  // Discuz! X3.4
  async checkCookie() {
    let rep = await this.axiosInst.get(this.config.fullUrl('/home.php?mod=spacecp'));
    let uid = /uid=(\d+)/.exec(rep.data);
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
    let rep = await this.axiosInst.get(this.config.fullUrl('/home.php?mod=spacecp&ac=usergroup&do=forum'));
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
        canShow: _.defaultTo($($tr.find('td').get(0)).find('img').attr('alt'), '').indexOf('invalid') < 0,
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

  async parsePage($, cateId) {
    let posts = [];
    for (let tbody of $('#threadlist #threadlisttableid tbody') as any) {
      let $tbody = $(tbody);
      // 排除置顶的
      let attId = $tbody.attr('id');
      let post = this.newPost();
      if (attId && attId.indexOf('normalthread') >= 0) {
        post.id = getInt(attId).toString();
        post.url = `/forum.php?mod=viewthread&tid=${post.id}`;
        post.viewNum = parseInt($tbody.find('.num>em').text());
        post.replyNum = parseInt($tbody.find('.num>a').text());
        let $th = $tbody.find('th');
        post.canReply = $th.attr('class').indexOf('lock') < 0;
        post.title = $th
          .find('a')
          .filter((i, v) => v.attribs && v.attribs.href.indexOf(post.id) > 0)
          .text()
          .trim();
        let $bys = $tbody.find('.by');
        let $authorA = $bys.eq(0).find('cite a');
        if ($authorA.length > 0) {
          //还有匿名的情况
          post.authorId = /uid=(\d+)/.exec($authorA.attr('href'))[1];
        }
        let timeTxt: string;
        let $time1 = $bys
          .eq(0)
          .find('em span')
          .filter((i, x) => x.attribs && x.attribs.title);
        if ($time1.length > 0) timeTxt = $time1.attr('title');
        else timeTxt = $bys.eq(0).find('em').text();
        post.createTime = new Date(timeTxt.trim());
        post._lastReplyUser = {
          uname: $bys.eq(1).find('cite').text().trim(),
        };
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

  // async fetchPages(cateId) {
  //   let pageMax = 1;
  //   for (let page = 1; page <= pageMax; page++) {
  //     await runSafe(
  //       async () => {
  //         // 按发帖时间
  //         let listUrl = this.config.fullUrl(`/forum.php?mod=forumdisplay&fid=${cateId}&orderby=dateline&page=${page}`);
  //         let res = await this.fetchPage(listUrl);
  //
  //         if (res == null) {
  //           //没有权限
  //           return;
  //         }
  //
  //         let ps: any = res.posts.map((v) => {
  //           //添加到队列
  //           return this.queueAddPost(v);
  //         });
  //
  //         if (page == 1) {
  //           pageMax = res.pageMax;
  //           this.logger.info('最大', pageMax);
  //         }
  //       },
  //       async () => {
  //         await sleep(5000);
  //         return false;
  //       },
  //     );
  //   }
  // }

  startFindLinks(cates: any[], cnf: IPostParseConfig = {}): Promise<any> {
    cnf.pageUrlExt = '&orderby=dateline';
    return super.startFindLinks(cates, cnf);
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
    post.site = this.config.key;
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
        reply.updateTime = reply.createTime;
        reply._innerId = this.parseInnerId($p.find(`#postnum${pid}`).text().trim());
        // 正文
        let $body = $(`#postmessage_${pid}`);
        reply.body = $body.text().trim();
        reply._html = $(`#post_${pid}`).html();
        reply.bodyBin = reply._html;

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

  async getFormData($form) {
    let data = {};
    $form.find('input').each((i, ipt) => {
      let ttype = ipt.attribs.type;
      if (ttype == 'submit' || ttype == 'checkbox' || ipt.attribs.disabled != null) {
        return;
      } else {
        let name = ipt.attribs.name;
        let value = ipt.attribs.value;
        data[name] = value;
      }
    });
    return data;
  }

  async sendReply(post: Post, text: string): Promise<any> {
    this.logger.info('准备回复', this.config.fullUrl(post.url), text);
    //&fid=${post.categoryId}
    let purl = this.config.fullUrl(`/forum.php?mod=post&action=reply&extra=&tid=${post.id}`);
    let rep = await this.axiosInst.get(purl);
    let $ = cheerio.load(rep.data);
    let $form = $(`#postform`);
    let formData = await this.getFormData($form);
    formData['message'] = `[color=#000001]${text}[/color]`;
    let pd = urlencode.stringify(formData, { charset: this.config.charset });
    let res = await this.axiosInst.post(
      this.config.fullUrl(`/forum.php?mod=post&action=reply&tid=${post.id}&extra=&replysubmit=yes`),
      pd,
    );
    $ = cheerio.load(res.data);
    return this.checkPermission($);
  }

  getPostUrl(pid, page = 1): string {
    return this.config.fullUrl(`/forum.php?mod=viewthread&tid=${pid}&extra=&page=${page}`);
  }

  getPostListUrl(cateId, page = 1, ext = ''): string {
    return this.config.fullUrl(`/forum.php?mod=forumdisplay&fid=${cateId}&page=${page}${ext}`);
  }

  // 伪造推广访问
  async promotionVisit() {
    let fromIP = randomCnIP();
  }

  //参与投票
  async replyVote(post: Post) {
    this.logger.info('投票', this.getPostUrl(post.id));
    post = await this.fetchPost(post);
    let $ = cheerio.load(`<div>${post._html}</div>`);
    let $form = $('#poll');
    if ($form.text().indexOf('您已经投过票') > 0) {
      this.logger.info('您已经投过票');
      return false;
    }
    let pUrl = this.config.fullUrl($form.attr('action'));
    let fv = await this.getFormData($form);
    let ck = $form.find('#option_1');
    fv[ck.attr('name')] = ck.val();
    let rep = await this.axiosInst.post(pUrl, qs.stringify(fv));
    this.logger.info('投票结果', JSON.stringify(fv));
    let ok = rep.status == 200;
    if (ok) {
      //标记
    }
    return ok;
    // https://www.abooky.com/forum.php?mod=forumdisplay&fid=50&filter=author&orderby=dateline&specialtype=poll
  }

  async checkin() {
    if (this.config.checkinUrl == null) {
      this.logger.info('无签到配置');
      return;
    }
    let ck: CheckinHandler;
    if (this.config.checkinUrl.indexOf('k_misign') > 0) {
      ck = new KmiSign(this);
    }
    return await ck.checkin();
  }

  async sendPost(cp, ext?: any) {
    let purl = this.config.fullUrl(`/forum.php?mod=post&action=newthread&fid=${cp.categoryId}`);
    let rep = await this.axiosInst.get(purl);
    let $ = cheerio.load(rep.data);
    let $form = $('#postform');
    let formData = await this.getFormData($form);
    formData['message'] = cp.body;
    formData['subject'] = cp.title;
    let $typeid = $('#typeid');
    if ($typeid != null) {
      formData['typeid'] = $typeid.find('option').eq(1).val();
    }
    if (ext && ext.typeid) formData['typeid'] = ext.typeid;
    let res = await this.axiosInst.post(
      this.config.fullUrl($form.attr('action')),
      urlencode.stringify(formData, { charset: this.config.charset }),
    );
    let $res = cheerio.load(res.data);
    let $alt = $res('#messagetext');
    let msg = $alt.text();
    this.logger.debug(msg);
    return res.status == 200;
  }
}

class KmiSign extends CheckinHandler {
  site: SiteCrawlerDiscuz;
  constructor(site: SiteCrawlerDiscuz) {
    super(async () => {
      let u = this.site.config.fullUrl(this.site.config.checkinUrl);
      let rep = await this.site.axiosInst.get(u);
      return rep.data;
    });
    this.site = site;
  }
  async doCheck($: CheerioStatic): Promise<boolean> {
    let link = $('#JD_sign').attr('href');
    if (!link.startsWith('/')) {
      link = '/' + link;
    }
    let rep = await this.site.axiosInst.get(this.site.config.fullUrl(link));
    this.site.logger.info(rep.data);
    return true;
  }

  isChecked($: CheerioStatic): boolean {
    let a = $('#qiandaobtnnum').next();
    let info = a.text().trim();
    if (info.indexOf('排名') >= 0) {
      this.site.logger.info(info);
      return true;
    }
    return false;
  }
}
