/**
 * 配置项
 */
import { ClientOptions } from '@elastic/elasticsearch';
import * as YAML from 'yaml';
import fs = require('fs');
import _ = require('lodash');
import { Post } from '../post';
import { getLogger } from 'log4js';

/**
 * 爬取站点的配置
 */
export class SiteConfig {
  name: string;
  host: string;
  siteType?: SiteType = SiteType.Normal;
  https?: boolean = false;
  logLevel?: string = 'debug';
  beforeReq?: (res, done) => any; //处理函数
  getHeaders?: () => any = () => {};
  afterReq: (res, done) => any; //处理函数
  ex: any = {}; //额外的配置信息
  crawler: any = {}; //爬虫参数

  fullUrl(p) {
    return `http${this.https ? 's' : ''}://${this.host}${p}`;
  }
}

/**
 * 站点类型
 */
export enum SiteType {
  Normal,
  Discuz, //discuz论坛
}

/**
 * 主程序配置
 */
export class MainConfig {
  dataPrefix: string = 'node_crawler_';
  es: ClientOptions;

  static default(c?: MainConfig) {
    if (c != null) {
      defaultConfig = c;
    }
    return defaultConfig;
  }

  static loadYAML(file: string): MainConfig {
    let yamlRes = YAML.parse(fs.readFileSync(file).toString());
    let c = new MainConfig();
    return _.merge(c, yamlRes);
  }

  static logger() {
    return defaultLogger;
  }
}
let defaultLogger = getLogger('main');
defaultLogger.level = 'debug';
let defaultConfig: MainConfig = null;
