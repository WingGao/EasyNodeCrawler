import { Builder, By, Key, until, WebDriver } from 'selenium-webdriver';
export async function waitUntilLoad(driver) {
  await driver.wait(async () => {
    return (
      (await driver.executeScript(`
        return document.readyState
        `)) == 'complete'
    );
  }, 1000);
}

export async function addCookie(driver: WebDriver, cs: string, domain: string) {
  for (let cs1 of cs.split(';')) {
    let cs2 = cs1.split('=');
    let ck = { name: cs2[0], value: cs[1], domain };
    await driver.manage().addCookie(ck);
  }
}
