import { SiteCrawler, IPostParseConfig } from './normal';
import { SiteConfig } from '../config';
import { initConfig } from '../index';
import { waitUntilLoad } from '../utils/selenium';
import { By, WebElement } from 'selenium-webdriver';
import fs = require('fs');
import path = require('path');
import { Post } from '../post';

class Zhonghuayuwen extends SiteCrawler {
  checkPermission($: any): boolean {
    throw new Error('Method not implemented.');
  }
  parsePage(
    $: CheerioStatic,
    cateId?: any,
    html?: string,
  ): Promise<{ posts: import('../post').Post[]; $: CheerioStatic; pageMax: number }> {
    throw new Error('Method not implemented.');
  }
  checkCookie() {
    throw new Error('Method not implemented.');
  }
  parsePost(post: Post, $: any, pcf?: IPostParseConfig): Promise<import('../post').Post> {
    throw new Error('Method not implemented.');
  }
  getPostUrl(pid: any, page?: number): string {
    throw new Error('Method not implemented.');
  }
  getPostListUrl(cateId: any, page?: number, ext?: string): string {
    throw new Error('Method not implemented.');
  }
  sendReply(post: Post, text: string) {
    throw new Error('Method not implemented.');
  }
  sendPost(cp: Post, ext?: any): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  constructor() {
    let config = new SiteConfig('corpus.zhonghuayuwen.org', {
      host: 'corpus.zhonghuayuwen.org',
      enableSave: false,
    });
    super(config);
  }

  async startFindLinks(): Promise<any> {
    let driver = await this.getSelenium();
    await driver.get(this.config.fullUrl('/CnCindex.aspx'));
    await waitUntilLoad(driver);
    // language=js
    await driver.executeScript(`
    document.querySelector('#TextBoxCCkeywords').value='好';
    document.querySelector('#DropDownListPsize').value=500;
    document.querySelector('#CheckBoxChuchu').checked=false;
    `);
    let btn = await driver.findElement(By.id('Button1'));
    await btn.click();
    let pageMax = 1;
    let file = fs.createWriteStream(path.resolve(__dirname, '../../spam/txt/hao.txt'));
    for (let page = 1; page <= pageMax; page++) {
      await driver.sleep(1000);
      await waitUntilLoad(driver);
      this.logger.info('当前', page);
      // language=js
      let rows = (await driver.executeScript(`
          let rows=[]
        document.querySelectorAll('#PanellSResults > div').forEach((div,i)=>{if(i==0)return;
        rows.push(div.children[1].innerText.trim())
        console.log(div)})
          return rows
      `)) as Array<string>;
      rows.forEach((r) => {
        if (r.length >= 10) {
          file.write(r + '\n');
        }
      });
      let nextPage = await driver.findElement(By.id('LBnextpageTop')).catch((e) => {});
      if (nextPage == null) break;
      await (nextPage as WebElement).click();
      pageMax++;
    }
  }
}

if (require.main === module) {
  (async () => {
    await initConfig('config/dev.yaml');
    const site = new Zhonghuayuwen();
    // await site.startFindLinks();
  })();
}
