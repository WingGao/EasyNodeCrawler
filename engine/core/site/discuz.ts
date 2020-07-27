import { SiteCrawler } from './normal';
import axios from 'axios';
import * as iconv from 'iconv-lite';
import cheerio = require('cheerio');
import _ = require('lodash');

export class SiteCrawlerDiscuz extends SiteCrawler {
  async checkCookie() {
    let rep = await axios.get(this.config.fullUrl('/home.php'), {
      headers: this.config.getHeaders(),
      responseType: 'arraybuffer',
    });
    let data = iconv.decode(rep.data, 'gbk');
    let uid = /uid=(\d+)/.exec(data);
    if (uid.length > 1) {
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
}
