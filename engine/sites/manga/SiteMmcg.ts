import { initConfig } from '../../core';
import { SiteConfig } from '../../core/config';
import { NormalCrawler } from '../../core/site/normal';
import cheerio = require('cheerio');
import * as path from 'path';
import { Progress } from '../../core/utils';
import genericPool = require('generic-pool');
if (require.main === module) {
  (async () => {
    await initConfig();
    let cnf = new SiteConfig('mmcg');
    let crawler = new NormalCrawler(cnf);
    await crawler.init();
    crawler.ensureTempDir();
    let bookUrl = `http://18h.mm-cg.com/18H_5741.html`;
    let rep = await crawler.axiosInst.get(bookUrl);
    let $ = cheerio.load(rep.data);
    let title = $('h1').text().trim();
    let dir = path.resolve(cnf.tempPath, title);
    let items = [];
    $('script').filter((i, sc) => {
      let $sc = $(sc);
      let html = $sc.html();
      if (html.indexOf('Large_cgurl') > 0) {
        let Large_cgurl = [];
        let re = /Large_cgurl\[\d+\][^"']+"([^"']+)"/g;
        items = [...html.matchAll(re)];
        return true;
      }
    });
    crawler.logger.info('准备下载', dir);
    let pool = genericPool.createPool(
      {
        create: () => new Date() as any,
        destroy: () => 1 as any,
      },
      { max: 5 },
    );
    let pg = new Progress(items.length);
    for (let g of items) {
      pool.acquire().then(async (c) => {
        await crawler.download(g[1], { desDir: dir, createDir: true });
        pg.incr();
        crawler.logger.info(pg.fmt());
        pool.release(c);
      });
    }
    await pool.drain();
    pool.clear();
    crawler.logger.info('完成');
  })();
}
