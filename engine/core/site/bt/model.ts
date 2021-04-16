import ESClient, { EsModel } from '../../es';
import { MainConfig } from '../../config';
import crypto = require('crypto');

// 需要和Post保持一致
export class BtTorrent extends EsModel<BtTorrent> {
  static NOT_FOUND = 'NOT_FOUND';
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
  _isHot: boolean; //是否热门
  _watchReason?: string; //被标记的原因
  hasFiles: boolean; //知否处理过文件
  hasBt: boolean; //是否处理过种子
  _ignoreOld?: boolean; //在检查增量时是否忽略
  _downloadNum: number; //正在下载人数
  _completeNum: number; //已完成人数

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
            deleteAt: { type: 'date' },
            hash: { type: 'keyword' },
            upNum: { type: 'integer' },
            hasFiles: { type: 'boolean' },
            hasBt: { type: 'boolean' },
          },
        },
      },
    });
    return true;
  }

  indexName() {
    return BtTorrent.indexName;
  }
  static get indexName() {
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
export class BtSubItem extends EsModel<BtSubItem> {
  site: string;
  tid: number; //种子id
  fname: string; //文件名称
  fsize: number; //网页上的数值，非精确
  fsizeExact: number; //精确文件大小
  hashs?: {
    offset: number; //起始位置byte
    pieceLength: number; //piece大小byte
    pieces: Array<IFileHashPiece>;
  };
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
            fsizeExact: { type: 'long' },
            hashs: { type: 'nested' },
          },
        },
      },
    });
    return true;
  }

  static get indexName() {
    return `${MainConfig.default().dataPrefix}bt_sub_item`;
  }

  indexName() {
    return BtSubItem.indexName;
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

export interface IFileHashPiece {
  i: number; //起始位置
  hash: string;
}

export enum BtFieldType {
  UNKNOWN,
  TITLE,
  SIZE,
  SEEDERS,
  LEECHERS,
  COMPLETE,
  CREATE_TIME,
}
