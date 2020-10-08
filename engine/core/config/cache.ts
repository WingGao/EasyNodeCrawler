import KVItem from '../model/kv';
import _ = require('lodash');

export default class SiteCacheInfo {
  site: string;
  cateLastMap: { [key: string]: any } = {}; //对应增量标记
  other: { [key: string]: any } = {};

  async load(siteKey?: string) {
    if (siteKey == null) siteKey = this.site;
    let kv = new KVItem(siteKey + '-cache');
    kv = await kv.getById(kv.key);
    if (kv != null) {
      let ob = JSON.parse(kv.value);
      _.merge(this, ob);
    }
    this.site = siteKey;
    return true;
  }

  save() {
    let kv = new KVItem(this.site + '-cache', JSON.stringify(this));
    return kv.save();
  }
}
