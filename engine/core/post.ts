/**
 * 爬取的文章数据
 */
import ESClient, { EsModel } from './es';
import { MainConfig } from './config';
// import brotli = require('brotli');
import _ = require('lodash');

export class Post extends EsModel<Post> {
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
  canReply: boolean; //能否回复
  // _开头的都是不保存的属性
  _lastReplyUser?: { uname: string };
  _replyList: Array<Post>; //回复列表
  _innerId: number; //楼层号
  _currentPage: number; //所在页码
  _html?: string;
  _imgs?: Array<string>;
  _ext?: any;
  _isTop?: boolean;
  _ignoreOld?: boolean; //在检查增量时是否忽略
  uniqId() {
    return `${this.site}-${this.id}`;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}post`;
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
            canReply: { type: 'boolean' },
          },
        },
      },
    });
    return true;
  }

  encodeBody(sc: number) {
    if (this.bodyBin == null) return;
    switch (sc) {
      case 1:
        break;
      case 2:
        // this.bodyBin = Buffer.from(brotli.compress(Buffer.from(this.bodyBin))).toString('base64');
        break;
      default:
        this.bodyBin = null;
    }
  }
  decodeBodyBrotli() {
    if (this.bodyBin == null) return;
    // let b = Buffer.from(this.bodyBin, 'base64');
    // return Buffer.from(brotli.decompress(b)).toString();
  }

  newOne() {
    return new Post();
  }
}
