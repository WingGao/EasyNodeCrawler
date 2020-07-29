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
  cookie?: string;
  afterReq?: (res, done) => any; //处理函数
  ex?: any = {}; //额外的配置信息
  crawler?: any = {}; //爬虫参数
  proxys?: IProxy[] = []; //代理，第一个是主代理
  toZh?: boolean = false; //转为简体
  saveBody?: 0 | 1 | 2 = 0; //保存body内容,0=不保存,1=保存源文本,2=保存压缩brotli
  enableSave?: boolean = true; //是否开启保存
  myUsername?: string; //我的用户名，区分用户
  selenium?: boolean = false;

  constructor(props?: Partial<SiteConfig>) {
    _.merge(this, props);
  }

  fullUrl(p) {
    return `http${this.https ? 's' : ''}://${this.host}${p}`;
  }
}
interface IProxy {
  type: 'http' | 'sock5';
  host: string;
  port?: number;
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
  redis: {
    host: string;
    port: number;
  };

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
