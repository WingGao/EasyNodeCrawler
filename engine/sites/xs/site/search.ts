import { Builder, ThenableWebDriver, WebDriver } from "selenium-webdriver";
import { DriverFirefoxWing } from "./selenium-wing";
import path = require('path');
import log4js = require('log4js');
import crypto = require('crypto');
import "reflect-metadata"
import Redis from "../../../core/redis";
import { MainConfig } from "../../../core/config";
import { Redis as iRedis } from "ioredis";
import { load as cLoad } from "cheerio";
import { checkSrcType, initDB, pageRepo, PageResult, Person, personRepo } from "../mod";
import _ = require("lodash");
import XLSX = require('xlsx');
import { GoogleResultParserCAS } from "./s_cas";
import GctAminer from "./s_gctaminercn";

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

// 通过谷歌搜索
async function doGoogle(person: Person, save = false) {
    let surl = `https://www.google.com/search?q=${encodeURIComponent(`${person.enName} ${person.org}`)}&num=30`
    let cacheKey = Redis.buildKeyMd5('node_xs:cache:', surl)
    logger.info('doGoogle', surl, cacheKey)
    let useCache = true
    let page = await Redis.setIfNull(cacheKey, async () => {
        useCache = false;
        await _driver.driver.get(surl)
        await _driver.waitBody()
        //TODO 精简html
        return await _driver.getDocument()
    })
    let $ = cLoad(page)
    let items = []
    // 判断是否触发验证
    if ($('#rso .g').length == 0 || $('#captcha-form').length > 0) {
        await redis.del(cacheKey)
        //触发识别
        logger.info('等待验证码')
        await _driver.driver.wait(async (d) => {
            let r = await d.executeScript(`return document.getElementById('captcha-form') == null`)
            return r
        }, 2 * 60 * 1000)
        await _driver.waitBody()
        page = await _driver.getDocument()
        await redis.set(cacheKey, page)
        $ = cLoad(page)
    }
    $('#rso .g').each((i, dom: any) => {
        let $dom = $(dom)
        let $h3 = $dom.find('h3')
        let $a = $h3.parent()
        let $desc = $a.parent().next().find('span')
        let item = _.merge(new PageResult(), {
            title: $h3.text(),
            url: $a.attr('href'),
            googleDesc: $desc.text(),
            googleIdx: i + 1,
            personId: person.id,
        })
        item.srcType = checkSrcType(item.url)
        items.push(item)
    })
    if (save) {
        await Promise.all(items.map(async (item) => {
            return pageRepo.upsertByUrl(item)
        }))
    }
    return { items, useCache }
}

async function getPerson(op: Person) {
    let person = await personRepo.findOne({ enName: op.enName, org: op.org })
    if (person == null) {
        person = await personRepo.save(op)
    }
    return person
}

function saveRows(rows, headers, outPath) {
    rows.splice(0, 0, headers);
    let book = XLSX.utils.book_new();
    let sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(book, sheet);
    XLSX.writeFile(book, outPath);
}


async function main() {
    //@ts-ignore
    global.aawait = require('deasync-promise')
    await initDB()
    await getDriver();
    let book = XLSX.readFile("d:\\Weiyun\\手动同步\\wins\\xs\\华人名单-CAS-v2.xlsx");
    let targetOrg = "Chinese Academy of Sciences"
    let sheet = book.Sheets[book.SheetNames[0]];
    let rows = XLSX.utils.sheet_to_json(sheet);
    let exportRows = []
    // let step = 'google' //获取搜索结果
    // let step = 'google-result' //处理搜索结果
    // let step = 'reset-html'
    // let step = 'gct'
    let step = 'export-name' //导出名字
    let googleParsers = {
        [GoogleResultParserCAS.Type]: new GoogleResultParserCAS()
    }
    let endFun
    let stepFun: (row, person: Person) => Promise<void>
    switch (step) {
        case 'export-name': {
            stepFun = async (row, person: Person) => {
                exportRows.push([person.id.toHexString(), person.cnName])
            }
            endFun = async () => {
                saveRows(exportRows, ['id', 'cnName'], path.resolve(__dirname, '../temp/tmp.xlsx'))
            }
            break
        }
    }
    for (let i = 0; i < rows.length; i++) {
        let row = rows[i] as any
        logger.info(`${i + 1}/${rows.length} ${row.Name}`)
        let person = new Person()
        person.enName = row.Name.trim()
        person.org = targetOrg
        person = await getPerson(person)
        switch (step) {
            case 'google': {
                if (person.google == null || person.google < 1) {
                    let { items, useCache } = await doGoogle(person, true)
                    if (items.length == 0) throw new Error("empty google")
                    person.googleResults = items.map(v => v.id)
                    person.google = 1
                    await personRepo.save(person)
                    if (useCache) await _driver.driver.sleep(2000)
                }
                break
            }
            case 'google-result':
                if (person.google == null || person.google < 1) {
                    logger.error(Person, '当前google为', person.google)
                } else if (person.google == 1) {
                    let items = await pageRepo.find({
                        where: { _id: { $in: person.googleResults }, srcType: { $ne: null } },
                    })
                    let itemsMap = _.keyBy(items, v => v.id.toString())
                    await Promise.all(_.map(person.googleResults, (async (pid) => {
                        let item = itemsMap[pid.toString()]
                        if (item == null) return
                        let parser = googleParsers[item.srcType]
                        if (parser != null) {
                            let r = await parser.parseItem(person, item)
                            if (item._changed) await pageRepo.save(r)
                        }
                    })))
                }
                break
            case 'reset-html': {
                let items = await pageRepo.find({
                    where: {
                        personId: person.id,
                        html: { $exists: true, $ne: null }
                    }
                })
                await Promise.all(_.map(items, (async (item: PageResult) => {
                    return await pageRepo.resetHtml(item.id)
                })))
                break
            }
            case 'gct': {
                if (person.gct == null) {
                    let useCache = await GctAminer.search(person)
                    // if (items.length == 0) throw new Error("empty google")
                    // person.googleResults = items.map(v => v.id)
                    // person.google = 1
                    // await personRepo.save(person)
                    if (useCache) await _driver.driver.sleep(2000)
                }
                break
            }
            default:
                if (stepFun != null) await stepFun(row, person)
                break
        }
    }
    if (endFun != null) await endFun()
}

main()
