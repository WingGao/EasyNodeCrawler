import { BtCrawler } from '../index';

export class BtSiteBaseConfig {
  key: string;
  host: string;
  https: boolean = true;
  torrentPages: Array<string> = [];
  myUsername: string; //我的用户名，区分用户
  myUserId: string;
  downloadThread: number = 3;
  downloadDelay: number = 0;
  checkin: boolean = true;
  doCheckin?: (bt: BtCrawler) => Promise<boolean>;
  parsePage?: (
    bt: BtCrawler,
    $: CheerioStatic,
    cateId?,
    html?: string,
  ) => Promise<{ posts: Array<any>; $: CheerioStatic; pageMax: number }>;
  pageStart0: boolean = false;
}
