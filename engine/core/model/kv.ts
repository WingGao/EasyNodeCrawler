import ESClient, { EsModel } from '../es';
import { MainConfig } from '../config';

export default class KVItem extends EsModel<KVItem> {
  key: string;
  value: any;
  constructor(key?: string, val?: any) {
    super();
    this.key = key;
    this.value = val;
  }
  async _createIndex(): Promise<boolean> {
    let res = await ESClient.inst().indices.create({
      index: this.indexName(),
      body: {
        mappings: {
          properties: {
            value: { type: 'binary' },
          },
        },
      },
    });
    return true;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}cache`;
  }

  newOne() {
    return new KVItem();
  }

  uniqId() {
    return this.key;
  }
}
