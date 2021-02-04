import { BtCrawler } from '../index';
import { BtTorrent } from '../model';
import { AxiosInstance, AxiosResponse } from 'axios';

export class BtSiteBaseConfig {
  key: string;
  alias: string[] = []; //key的别名，用于网站改名
  host: string;
  https: boolean = true;
  torrentPages: Array<string> = [];
  myUsername: string; //我的用户名，区分用户
  myUserId: string;
  downloadThread: number = 3;
  downloadDelay: number = 0;
  checkin: boolean = true;
  doCheckin?: (bt: BtCrawler) => Promise<boolean> = null;
  checkCookie?: (bt: BtCrawler) => Promise<boolean> = null; //自定义验证cookie
  pageResultCheck?: number;
  parsePage?: (bt: BtCrawler, $: CheerioStatic, cateId?, html?: string) => Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }> = null;
  parsePageNum?: (bt: BtCrawler, $: CheerioStatic) => number = null; //自定义页数解析，自然数
  parsePageTr?: (bt: BtCrawler, $: CheerioStatic, $tr: Cheerio, torrent: BtTorrent) => void = null;
  pageStart0: boolean = false;
  downloadBtFileBuilder?: (bt: BtCrawler, tid: number) => Promise<AxiosResponse>;
  hotRate: number[] = [40, 60]; //0=30分钟 1=1小时
  watchRules = {}; //特殊的种子需要提醒
  fetchFileMode = BtSiteBaseConfig.FETCH_MODE_DOWNLOAD;

  static FETCH_MODE_DOWNLOAD = 1; //下载种子
  static FETCH_MODE_FETCH = 2; // 爬取文件列表
  static FETCH_MODE_TASK = 3; // 提交到task
}
