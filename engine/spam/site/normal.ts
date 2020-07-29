import { SiteConfig } from '../../core/config';

export default class SpamNormal {
  config: SiteConfig;
  constructor(config: SiteConfig) {
    this.config = config;
  }

  async start(args: any) {}

  // 语料库 http://corpus.zhonghuayuwen.org/CnCindex.aspx
  async getRandomText() {}
}
