import { Client } from '@elastic/elasticsearch';
import { MainConfig } from '../config';
import _ = require('lodash');
import { ApiResponse } from '@elastic/elasticsearch/lib/Transport';
import { Progress } from '../utils';

let mainClient: Client = null;
export default class ESClient {
  static inst() {
    if (mainClient == null) {
      mainClient = new Client(MainConfig.default().es);
    }
    return mainClient;
  }

  static checkRep(rep: ApiResponse) {
    if (rep.statusCode >= 200 && rep.statusCode < 300) {
      return true;
    }
    //bulk
    if (rep.body.errors) {
      debugger;
    }
    throw new Error(rep.body.toString());
  }
}

export abstract class EsModel<T> {
  constructor(props?: Partial<T>) {
    if (props) _.merge(this, props);
  }

  abstract uniqId();

  abstract indexName();

  abstract newOne();

  abstract _createIndex(): Promise<boolean>;

  async loadById(id?) {
    if (id == null) id = this.uniqId();
    return this.getById(id, true);
  }

  async getById(id: string, load = false) {
    let res = await ESClient.inst()
      .get({
        index: this.indexName(),
        id,
      } as any)
      .catch((e) => e);

    if (res.statusCode == 200) {
      if (load) {
        return _.merge(this, res.body._source);
      } else {
        let p = this.newOne();
        return _.merge(p, res.body._source);
      }
    } else {
      return null;
    }
  }

  getBody() {
    let body = _.pickBy(this, (v, k) => {
      return k.indexOf('_') != 0 && v != undefined && !_.isFunction(v);
    });
    return body;
  }

  /**
   * 全量更新
   */
  async save() {
    let body = this.getBody();
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
    // MainConfig.logger().debug('ES', `[${pa.index}, ${pa.id}]`, res.body.result, res.statusCode);
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

  async update(p: Partial<T>) {
    let res = await ESClient.inst().update({
      index: this.indexName(),
      id: this.uniqId(),
      body: { doc: p },
    });
    if (res.statusCode == 200) {
      _.merge(this, p);
    } else {
      throw new Error(res.body.result);
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

  /**
   * 单线程的遍历
   * @param query
   * @param onItem
   */
  async scrollSearch(query: any, onItem: (p: T, pg: Progress) => Promise<void>) {
    let pg = new Progress();
    let ssp = ESClient.inst().helpers.scrollSearch({
      index: this.indexName(),
      scroll: '1h',
      body: {
        size: 20,
        sort: [
          {
            createTime: {
              order: 'desc',
            },
          },
        ],
        query,
      },
    });

    for await (const result of ssp) {
      if (pg.total == 0) pg.total = result.body.hits.total.value;
      for (let bt of result.body.hits.hits) {
        let btv = this.constructor(bt._source);
        pg.incr();
        await onItem(btv, pg);
      }
    }
  }
}
