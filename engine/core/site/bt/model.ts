import ESClient, { EsModel } from '../../es';
import { MainConfig } from '../../config';
import crypto = require('crypto');

export class BtTorrent extends EsModel {
  tid: number; //种子id
  site: string;
  categoryId: string;
  title: string;
  title2: string; //副标题
  fsize: number; //种子大小
  _fsizeH: string;
  createTime: Date; //创建日期
  hash: string;
  upNum: number; //上传数
  _isTop: boolean; //是否置顶
  _isFree: boolean; //是否免费
  hasFiles: boolean; //知否处理过文件

  get id() {
    return this.tid;
  }

  async _createIndex(): Promise<boolean> {
    let res = await ESClient.inst().indices.create({
      index: this.indexName(),
      body: {
        mappings: {
          properties: {
            site: { type: 'keyword' },
            tid: { type: 'integer' },
            categoryId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            title2: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            fsize: { type: 'long' },
            createTime: { type: 'date' },
            hash: { type: 'keyword' },
            upNum: { type: 'integer' },
            hasFiles: { type: 'boolean' },
          },
        },
      },
    });
    return true;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}bt_torrent`;
  }

  newOne() {
    return new BtTorrent();
  }

  uniqId() {
    return `${this.site}-${this.tid}`;
  }
}
/**
 * 每个种子里的成员文件，用于拆包
 */
export class BtSubItem extends EsModel {
  site: string;
  tid: number; //种子id
  fname: string; //文件名称
  fsize: number;
  hashs?: Array<any>;
  _fsizeH: string;
  async _createIndex(): Promise<boolean> {
    let res = await ESClient.inst().indices.create({
      index: this.indexName(),
      body: {
        mappings: {
          properties: {
            site: { type: 'keyword' },
            tid: { type: 'integer' },
            fname: { type: 'keyword' },
            fsize: { type: 'long' },
            hashs: { type: 'nested' },
          },
        },
      },
    });
    return true;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}bt_sub_item`;
  }

  newOne() {
    return new BtSubItem();
  }

  uniqId() {
    let ag = crypto.createHash('md5');
    ag.update(this.fname);
    return `${this.site}-${this.tid}-${ag.digest().toString('hex').substr(0, 10)}`;
  }
}
