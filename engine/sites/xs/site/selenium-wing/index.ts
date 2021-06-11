import { Builder, ThenableWebDriver, until, WebDriver } from "selenium-webdriver";
import firefox = require('selenium-webdriver/firefox');
import log4js = require('log4js');
import * as cheerio from 'cheerio'

const logger = log4js.getLogger('DriverFirefoxWing');
logger.level = 'debug';

export class DriverFirefoxWing {
    driver: WebDriver

    constructor(driver: WebDriver) {
        this.driver = driver
    }

    async waitBody() {
        await this.driver.wait(async () => {
            let r = await this.driver.executeScript("return document.readyState")
            return r == "complete"
        }, 30 * 1000)
        logger.info("waitBody done")
    }

    async getDocument() {
        return await this.driver.getPageSource()
    }

    async getJquery() {
        let page = await this.driver.getPageSource()
        return { $: cheerio.load(page), page }
    }

    static async build() {
        let options = new firefox.Options()
            // 跳过cloudfire https://stackoverflow.com/questions/60248740/how-to-set-navigator-webdriver-to-undefined-with-selenium-for-firefox-geckodriv
            .setPreference('dom.webdriver.enabled', false);
        let _driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
        return new DriverFirefoxWing(_driver)
    }
}
