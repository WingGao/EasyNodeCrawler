/**
 * 爬取的文章数据
 */
import ESClient from './es';
import { MainConfig } from './config';
import brotli = require('brotli');
import _ = require('lodash');

export class Post {
  site: string; //站点的host
  id: string;
  url: string; //相对路径
  title: string; //标题
  authorId: string; //用户id
  body: string; //正文内容，提取后的文本
  bodyBin: any; //正文压缩的内容
  createTime: Date; //创建日期
  updateTime: Date; //最后更新日期
  parentPostId: string;
  categoryId: string;
  viewNum: number; //查看次数
  replyNum: number; //回复数
  // _开头的都是不保存的属性
  _lastReplyUser: any;

  uniqId() {
    return `${this.site}-${this.id}`;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}post`;
  }

  async getById(id: string) {
    let res = await ESClient.inst()
      .get({
        index: this.indexName(),
        id,
      })
      .catch((e) => e);

    if (res.statusCode == 200) {
      let p = new Post();
      return _.merge(p, res.body._source);
    } else {
      return null;
    }
  }
  async save() {
    let body = _.pickBy(this, (v, k) => {
      return k.indexOf('_') != 0;
    });
    let pa = {
      index: this.indexName(),
      id: this.uniqId(),
      body,
    };
    // debugger;
    let res = await ESClient.inst()
      .create(pa)
      .catch((e) => {
        return e;
      });
    if (res.statusCode == 201) {
      return true;
    } else {
      switch (res.message) {
        case 'version_conflict_engine_exception': //重复
          return false;
        default:
          throw res;
      }
    }
  }

  async _createIndex() {
    let res = await ESClient.inst().indices.create({
      index: this.indexName(),
      body: {
        mappings: {
          properties: {
            site: { type: 'keyword' },
            id: { type: 'keyword' },
            authorId: { type: 'keyword' },
            categoryId: { type: 'keyword' },
            parentPostId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            body: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            bodyBin: { type: 'binary' },
            createTime: { type: 'date' },
            updateTime: { type: 'date' },
            viewNum: { type: 'integer' },
            replyNum: { type: 'integer' },
          },
        },
      },
    });
  }

  encodeBody(sc: number) {
    switch (sc) {
      case 1:
        break;
      case 2:
        this.bodyBin = Buffer.from(brotli.compress(Buffer.from(this.bodyBin))).toString('base64');
        break;
      default:
        this.bodyBin = null;
    }
  }
  decodeBodyBrotli() {
    let b = Buffer.from(this.bodyBin, 'base64');
    return Buffer.from(brotli.decompress(b)).toString();
  }
}
