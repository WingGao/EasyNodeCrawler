import * as chromeUtil from './chrome';
import { WebDriver } from 'selenium-webdriver';
let chrome: WebDriver;
beforeAll(async () => {
  chrome = await chromeUtil.getChrome();
  jest.setTimeout(3 * 60 * 1000);
});
describe('chrome', async () => {
  test('open', async () => {
    await chrome.get('http://baidu.com');
    await chrome.sleep(5000);
    expect(1).toBeFalsy();
  });
});
