import { Builder, ThenableWebDriver, WebDriver } from "selenium-webdriver";
import { DriverFirefoxWing } from "./selenium-wing";
import log4js = require('log4js');
import crypto = require('crypto');
import Redis from "../../../core/redis";
import { MainConfig } from "../../../core/config";
import { Redis as iRedis } from "ioredis";
import {load as cLoad} from "cheerio";

const md5 = crypto.createHash('md5');
const logger = log4js.getLogger();
logger.level = 'debug';
let _driver: DriverFirefoxWing;

let config = new MainConfig()
config.redis = { host: 'wsl.local', port: 6379 }
MainConfig.default(config)
const redis = Redis.inst() as iRedis

async function getDriver() {
    _driver = await DriverFirefoxWing.build()
}

async function doGoogle(name: string) {
    let url = `https://www.google.com/search?q=${encodeURIComponent(name)}`
    let cacheKey = `node_xs:cache:${md5.update(url).digest('hex')}`
    let page =await Redis.setIfNull(cacheKey,async ()=>{
        await _driver.driver.get(`https://www.google.com/search?q=${encodeURIComponent(name)}`)
        await _driver.waitBody()
        return await _driver.getDocument()
    })
    let $ = cLoad(page)
    let items = []
    $('#rso .g').each((i,dom:any)=>{
        let $dom = $(dom)
        let $h3 = $dom.find('h3')
        let $a = $h3.parent()
        let $desc = $a.parent().next() .find('span')
        let item = {
            title:$h3.text(),
            link: $a.attr('href'),
            desc:$desc.text(),
        }
        items.push(item)
    })
    debugger
}

async function main() {
    //@ts-ignore
    global.aawait = require('deasync-promise')
    await getDriver();
    await doGoogle("An Zhiseng" + " Chinese Academy of Sciences")
}

main()
