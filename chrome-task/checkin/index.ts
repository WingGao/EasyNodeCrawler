//签到
import { getChrome } from '../chrome';
import { By, until, WebDriver } from 'selenium-webdriver';
import { getLogger } from 'log4js';
import { waitUntilLoad } from '../../engine/core/utils';
import _ = require('lodash');

const logger = getLogger(`task:checkin`);
logger.level = 'debug';

export async function siteLeaguehdCom(chrome: WebDriver) {
  await siteNexusPHP(chrome, `https://leaguehd.com/userdetails.php?id=26801`, {});
}
export async function siteSoulvoice(chrome: WebDriver) {
  await siteNexusPHP(chrome, `https://pt.soulvoice.club/userdetails.php?id=96892`, {});
}
export async function sitePterclub(chrome: WebDriver) {
  await siteNexusPHP(chrome, `https://pterclub.com/userdetails.php?id=10421`, {
    signDom: '#attendance-wrap',
    isSignDone: async () => {
      await chrome.wait(until.elementLocated(By.css('.jconfirm-title')));
    },
  });
}
export async function siteMoecat(chrome: WebDriver) {
  await siteNexusPHP(chrome, `https://moecat.best/userdetails.php?id=59808`, {});
}

interface INexusPHPConfig {
  signDom?: string;
  isSignDone?: () => Promise<any>;
}
export async function siteNexusPHP(chrome: WebDriver, homeUrl, conf: INexusPHPConfig) {
  logger.info('处理', homeUrl);
  conf = _.merge(
    {
      signDom: '#signtext',
    },
    conf,
  );
  const siteName = homeUrl;
  await chrome.get(homeUrl);
  await chrome.wait(until.elementLocated(By.id('info_block')));
  let signEle = await chrome.findElement(By.css(conf.signDom)).catch((e) => null);
  if (signEle == null) {
    logger.info(siteName, '已签到');
    return;
  } else {
    await signEle.click();
    await waitUntilLoad(chrome);
    if (conf.isSignDone != null) {
      await conf.isSignDone();
    }
    logger.info(siteName, '签到成功');
  }
}

if (require.main == module) {
  (async () => {
    let chrome = await getChrome();
    await siteLeaguehdCom(chrome);
    await sitePterclub(chrome);
    await siteSoulvoice(chrome);
  })();
}
