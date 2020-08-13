import { Builder, WebDriver } from 'selenium-webdriver';
import { Options, Driver } from 'selenium-webdriver/chrome';
import { addCookie, sleep } from '../engine/core/utils';

let chrome: WebDriver;
export async function getChrome() {
  if (chrome != null) return chrome;
  if (process.platform === 'win32') {
    let opts = new Options();
    let ld = process.env['LOCALAPPDATA'];
    opts.addArguments(`user-data-dir=${ld}\\Google\\Chrome\\User Data`);
    // let bd = new Builder().setChromeOptions(opts);
    // let driver = await bd.forBrowser('chrome').build();
    chrome = Driver.createSession(opts);
  } else {
    throw new Error('不支持的平台');
  }
  await sleep(3000);
  return chrome;
}
