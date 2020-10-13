import { CronJob } from 'cron';
import { MainConfig } from '../core/config';
import MTeamConfig from '../core/site/bt/sitecnf/pt_mteam_cc';
import { BtCrawler } from '../core/site/bt';
import { initConfig } from '../core';
import getSiteConfigs from '../core/site/bt/sitecnf';
import _ = require('lodash');
import WgwClient from '../core/utils/wgw';

async function btWatchFree(done?) {
  let ps = [];
  let c = getSiteConfigs();
  let html = '';
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
        let res = await site.watchFree(true);
        MainConfig.logger().info(`完成BtWatchFree`, sk);

        return _.size(res)
          ? `<div>
<h2>${sk}</h2><br/>
${res}
</div><br/>`
          : '';
      })(),
    );
  }
  let hs = (await Promise.all(ps).catch((e) => {
    MainConfig.logger().error(e);
    return '';
  })) as string[];
  if (_.find(hs, (v) => _.size(v) > 0) != null) {
    await WgwClient.inst().sendMail(`[BT] Watch Free`, hs.join(''));
  }
  if (done) done();
}
async function cron() {
  await initConfig();
  let tasks = [];
  tasks.push(
    new CronJob('0 5,35 * * * *', btWatchFree, () => {
      MainConfig.logger().info('BtWatchFree done');
    }),
  );
  tasks.forEach((v) => v.start());
  MainConfig.logger().info('cron start');
}
if (require.main === module) {
  let debug = false;
  if (debug) {
    (async () => {
      await initConfig();
      await btWatchFree();
    })();
  } else {
    cron();
  }
}
