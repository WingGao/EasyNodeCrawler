import { CronJob } from 'cron';
import { MainConfig } from '../core/config';
import MTeamConfig from '../core/site/bt/sitecnf/pt_mteam_cc';
import { BtCrawler } from '../core/site/bt';
import { initConfig } from '../core';
async function cron() {
  await initConfig();
  let tasks = [];
  tasks.push(
    new CronJob(
      '0 22 * * * *',
      async (done) => {
        MainConfig.logger().info('开始 mteam free');
        let btCnf = MTeamConfig;
        let site = new BtCrawler(btCnf);
        await site.init();
        await site.watchFree();
        done();
      },
      () => {
        MainConfig.logger().info('mteam free done');
      },
    ),
  );
  tasks.forEach((v) => v.start());
  MainConfig.logger().info('cron start');
}
if (require.main === module) {
  cron();
}
