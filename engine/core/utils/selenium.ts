import { Builder, By, Key, until, WebDriver } from 'selenium-webdriver';
import { URL } from 'url';

export async function waitUntilLoad(driver) {
  await driver.wait(async () => {
    return (
      (await driver.executeScript(`
        return document.readyState
        `)) == 'complete'
    );
  }, 1000);
}

export async function addCookie(driver: WebDriver, cs: string, mainUrl: string) {
  let url = await driver.getCurrentUrl();
  let mUrl = new URL(mainUrl);
  let domain = mUrl.host;
  if (url.indexOf(domain) < 0) {
    await driver.get(mainUrl);
    await waitUntilLoad(driver);
  }
  // 将cookie加载一级域名上
  let ds = domain.split('.');
  let rootDomain = `.${ds[ds.length - 2]}.${ds[ds.length - 1]}`;

  await driver.manage().deleteAllCookies();
  for (let cs1 of cs.split(';')) {
    let cs2 = cs1.split('=');
    let ck = { name: cs2[0], value: cs2[1], domain: rootDomain, httpOnly: true };
    await driver.manage().addCookie(ck);
  }
}

export async function getImageBase64(driver: WebDriver, loc: string) {
  //language=js
  let res = await driver.executeAsyncScript(`
  let callback = arguments[arguments.length - 1];
  (function (url, cb) {
  let xhr = new XMLHttpRequest();
  xhr.onload = function() {
    let reader = new FileReader();
    reader.onloadend = function() {
      cb(reader.result);
    }
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
})(document.querySelector("${loc}").src,callback)
`);
  // console.log(res);
  return res;
}
