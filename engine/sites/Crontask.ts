import { CronJob } from 'cron';
import { MainConfig } from '../core/config';
import MTeamConfig from '../core/site/bt/sitecnf/pt_mteam_cc';
import { BtCrawler } from '../core/site/bt';
import { initConfig } from '../core';
import getSiteConfigs from '../core/site/bt/sitecnf';
import _ = require('lodash');

async function btWatchFree(siteKey) {}
async function cron() {
  await initConfig();
  let tasks = [];
  tasks.push(
    new CronJob(
      '0 47 * * * *',
      async (done) => {
        let ps = [];
        let c = getSiteConfigs();
        for (let sk of [
          'mteam',
          // 'leaguehd'
        ]) {
          ps.push(
            (async () => {
              MainConfig.logger().info(`开始BtWatchFree`, sk);
              let btCnf = _.find(c, (v) => v.key == sk);
              let site = new BtCrawler(btCnf);
              await site.init();
              await site.watchFree();
              MainConfig.logger().info(`完成BtWatchFree`, sk);
            })(),
          );
        }
        await Promise.all(ps).catch((e) => {
          MainConfig.logger().error(e);
        });
        done();
      },
      () => {
        MainConfig.logger().info('BtWatchFree done');
      },
    ),
  );
  tasks.forEach((v) => v.start());
  MainConfig.logger().info('cron start');
}
if (require.main === module) {
  cron();
}
