import { Client } from '@elastic/elasticsearch';
import { MainConfig } from '../config';
import _ = require('lodash');

let mainClient: Client = null;
export default class ESClient {
  static inst() {
    if (mainClient == null) {
      mainClient = new Client(MainConfig.default().es);
    }
    return mainClient;
  }
}

export abstract class EsModel {
  abstract uniqId();

  abstract indexName();

  abstract newOne();

  abstract async _createIndex();

  async getById(id: string) {
    let res = await ESClient.inst()
      .get({
        index: this.indexName(),
        id,
      } as any)
      .catch((e) => e);

    if (res.statusCode == 200) {
      let p = this.newOne();
      return _.merge(p, res.body._source);
    } else {
      return null;
    }
  }

  /**
   * 全量更新
   * @param upsert
   */
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
      .index(pa as any)
      .catch((e) => {
        return e;
      });
    MainConfig.logger().debug('ES', `[${pa.index}, ${pa.id}]`, res.body.result, res.statusCode);
    if (res.statusCode == 201 || res.statusCode == 200) {
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

  async ensureIndex() {
    if (
      (await ESClient.inst()
        .indices.get({ index: this.indexName() })
        .catch((e) => {
          if (e.message == 'index_not_found_exception') {
            return false;
          }
        })) === false
    ) {
      MainConfig.logger().info('创建索引', this.indexName());
      let rep = await this._createIndex();
    }
  }
}
