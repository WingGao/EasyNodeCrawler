/**
 * 水贴记录
 */
import ESClient, { EsModel } from '../core/es';
import { MainConfig } from '../core/config';
import brotli = require('brotli');
import _ = require('lodash');

export class SpamRecord extends EsModel {
  site: string; //站点的host
  id: string; //帖子id
  categoryId: string;
  myLastReplyPos: number;
  myLastReplyPage: number;

  uniqId() {
    return `${this.site}-${this.id}`;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}spam_record`;
  }

  newOne() {
    return new SpamRecord();
  }

  async _createIndex() {
    let res = await ESClient.inst().indices.create({
      index: this.indexName(),
      body: {
        mappings: {
          properties: {
            site: { type: 'keyword' },
            id: { type: 'keyword' },
            categoryId: { type: 'keyword' },
            myLastReplyPos: { type: 'integer' },
            myLastReplyPage: { type: 'integer' },
          },
        },
      },
    });
  }
}
