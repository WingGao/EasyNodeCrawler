export class BtSiteBaseConfig {
  key: string;
  host: string;
  https: boolean = true;
  torrentPages: Array<string> = [];
  myUsername: string; //我的用户名，区分用户
  myUserId: string;
  downloadThread: number = 3;
  downloadDelay: number = 0;
}
