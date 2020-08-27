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
  key: string;
  host: string;
  siteType?: SiteType = SiteType.Normal;
  https?: boolean = false;
  logLevel?: string = 'debug';
  beforeReq?: (res, done) => any; //处理函数
  getHeaders?: () => any = () => {};
  cookie?: string;
  charset?: string = 'utf8';
  afterReq?: (res, done) => any; //处理函数
  ex?: any = {}; //额外的配置信息
  crawler?: any = {}; //爬虫参数
  proxys?: IProxy[] = []; //代理，第一个是主代理
  toZh?: boolean = false; //转为简体
  saveBody?: 0 | 1 | 2 | 3 = 0; //保存body内容,0=不保存,1=保存源文本,2=保存压缩brotli
  savePageResult?: boolean = false; //是否直接保存pagelist页面的结果（只保存标题，不注重内容）
  enableSave?: boolean = true; //是否开启保存
  myUsername?: string; //我的用户名，区分用户
  myUserId?: string;
  selenium?: boolean = false;
  replyPageSize: number = 10; //每个帖子下面的回复分页大小
  replyTimeSecond: number = 3 * 60; //帖子回复间隔，秒
  myReplyMaxPerPage: number = 5; //每页回复的帖子个数，防止屠版
  myPostMaxPerPage: number = 5; //主题数
  postBlacklist: Array<string> = []; //帖子黑名单，不处理
  checkinUrl?: string; //签到地址
  limit: LimitConfig = new LimitConfig();

  constructor(key: string, props?: Partial<SiteConfig>) {
    this.key = key;
    _.merge(this, props);
  }

  fullUrl(p) {
    if (p.indexOf('http') == 0) return p;
    if (!p.startsWith('/')) {
      p = '/' + p;
    }
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
  Phpwind,
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
  wgwHost?: string = 'https://wgw.suamo.art';
  userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0';

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

export class LimitConfig {
  share: number = -1; //发起分享
  vote: number = -1; //参与投票次数
  reply: number = -1; //回复次数
  thread: number = -1; //主题次数
  promotionVisit: number = -1; //访问推广
}
