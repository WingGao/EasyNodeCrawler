import { Builder, ThenableWebDriver, WebDriver } from "selenium-webdriver";
import { DriverFirefoxWing } from "./selenium-wing";
import path = require('path');
import log4js = require('log4js');
import crypto = require('crypto');

const { argv } = require('yargs')
import "reflect-metadata"
import Redis from "../../../core/redis";
import { MainConfig } from "../../../core/config";
import { Redis as iRedis } from "ioredis";
import { load as cLoad } from "cheerio";
import { checkSrcType, GTC_TYPE, initDB, pageRepo, PageResult, Person, personRepo, personRepoExt } from "../mod";
import _ = require("lodash");
import XLSX = require('xlsx');
import { GoogleResultParserCAS } from "./s_cas";
import GctAminer from "./s_gctaminercn";
import TianyanCha from "./s_tianyancha";

// const yargs = require('yargs/yargs')
// const { hideBin } = require('yargs/helpers')
// const argv = yargs(hideBin(process.argv)).argv

const logger = log4js.getLogger();
logger.level = 'debug';
let _driver: DriverFirefoxWing;

let config = new MainConfig()
config.redis = { host: 'wsl.local', port: 6379 }
MainConfig.default(config)
const redis = Redis.inst() as iRedis

let googleParsers = {
    [GoogleResultParserCAS.Type]: new GoogleResultParserCAS()
}

async function getDriver() {
    if (_driver == null) _driver = await DriverFirefoxWing.build()
    return _driver
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

// 处理谷歌结果
async function doGoogleResult(person: Person) {
    let items = await pageRepo.find({
        where: { _id: { $in: person.googleResults } },
    })
    let itemsMap = _.keyBy(items, v => v.id.toString())
    for (let i = 0; i < person.googleResults.length; i++) {
        let page = itemsMap[person.googleResults[i].toString()]
        if (page != null) {
            let parser = googleParsers[page.srcType]
            let pageNew
            if (parser != null) {
                pageNew = await parser.parseItem(person, page)
            }
            if (page._changed && pageNew != null) await pageRepo.save(pageNew)
        }
    }
}

async function getPerson(op: Person) {
    let person: Person
    // 先查exId
    if (op.exId != null) {
        person = await personRepo.findOne({ exId: op.exId })
        if (person != null) return person
    }
    person = await personRepo.findOne({ enName: op.enName, org: op.org })
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
    /**
     * 收集所有英文名的google搜索
     */

    //@ts-ignore
    global.aawait = require('deasync-promise')
    await initDB()
    let book = XLSX.readFile("d:\\Weiyun\\手动同步\\wins\\xs\\华人名单-单位合并.xlsx");
    // let targetOrg = "Chinese Academy of Sciences"
    let sheet = book.Sheets[book.SheetNames[0]];
    let rows = XLSX.utils.sheet_to_json(sheet);
    let exportRows = []
    let exportRows2 = []
    let step = 'google' //获取搜索结果
    // let step = 'google-result' //处理搜索结果
    // let step = 'reset-html'
    // step = 'gct'
    // step = 'gct-detail'
    // step = 'gct-publish'
    // step = 'gct-edu'
    // step = 'gct-edu-export'
    step = 'tyc-search'
    // step = 'tyc-export'
    // let step = 'export-name' //导出名字
    if (_.size(argv.step) > 0) step = argv.step
    let endFun
    let stepFun: (row, person: Person) => Promise<void>
    let tianyan = new TianyanCha()
    switch (step) { // 前置操作
        case 'google':
            await getDriver();
            break;
        case 'export-name': {
            stepFun = async (row, person: Person) => {
                exportRows.push([person.id.toHexString(), person.cnName])
            }
            endFun = async () => {
                saveRows(exportRows, ['id', 'cnName'], path.resolve(__dirname, '../temp/tmp.xlsx'))
            }
            break
        }
        case 'gct-edu-export': {
            stepFun = async (row, person: Person) => {
                _.forEach(person.gctEx?.eduList, v => {
                    exportRows.push([person.cnName, v])
                })
                _.forEach(person.gctEx?.workList, v => {
                    exportRows2.push([person.cnName, v])
                })
            }
            endFun = async () => {
                exportRows.splice(0, 0, ['cnName', 'edu']);
                let book = XLSX.utils.book_new();
                let sheet = XLSX.utils.aoa_to_sheet(exportRows);
                XLSX.utils.book_append_sheet(book, sheet);
                exportRows2.splice(0, 0, ['cnName', 'work']);
                sheet = XLSX.utils.aoa_to_sheet(exportRows2);
                XLSX.utils.book_append_sheet(book, sheet);
                XLSX.writeFile(book, path.resolve(__dirname, '../temp/edu_work.xlsx'));
            }
            break
        }
        case 'tyc-export': {
            let exportConfig = tianyan.exportToExcel()
            stepFun = async (row, person: Person) => {
                let rows = await exportConfig.onRow(person)
                if (rows != null) rows.forEach(er => {
                    exportRows.push(er)
                })
            }
            endFun = async () => {
                exportRows.splice(0, 0, exportConfig.headers);
                let book = XLSX.utils.book_new();
                let sheet = XLSX.utils.aoa_to_sheet(exportRows);
                XLSX.utils.book_append_sheet(book, sheet);
                XLSX.writeFile(book, path.resolve(__dirname, '../temp/tianyan.xlsx'));
            }
            break
        }
    }
    for (let i = 0; i < rows.length; i++) {
        let row = rows[i] as any
        logger.info(`${i + 1}/${rows.length} ${row.Name} ; ${row.Org}`)
        let person = new Person()
        person.enName = row.Name.trim()
        if (row.Org == null) continue
        person.org = row.Org.trim()
        person.exId = parseInt(row.id)
        let person2 = await getPerson(person)
        if (person2.exId == null) { //保存exId
            await personRepo.updateOne({ _id: person2.id }, { $set: { exId: person.exId } })
        }
        person = person2
        logger.info(`${person.enName}(${person.cnName}) : ${person.org}(${person.orgCn})`)
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
                if (person.google == 1) {
                    await doGoogleResult(person)
                    break
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
                } else {
                    logger.error(Person, '当前google为', person.google)
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
                if (person.gct != GTC_TYPE.MATCHED && person.gct != GTC_TYPE.NO_RESULT) {
                    // let useCache = await GctAminer.search(person)
                    let useCache = await GctAminer.searchUI(person)
                    // if (items.length == 0) throw new Error("empty google")
                    // person.googleResults = items.map(v => v.id)
                    // person.google = 1
                    // await personRepo.save(person)
                    // if (useCache) await _driver.driver.sleep(2000)
                }
                break
            }
            case 'gct-detail': {
                await GctAminer.fetchDetail(person)
                break
            }
            case 'gct-publish': {
                await GctAminer.fetchPublish(person)
                break
            }
            case 'gct-edu': {
                await GctAminer.parseEdu(person)
                break
            }
            case 'tyc-search': {
                await tianyan.searchUI(person)
                break
            }
            default:
                if (stepFun != null) await stepFun(row, person)
                break
        }
    }
    if (endFun != null) await endFun()
    logger.info('MainDone')
}

function gctEduExport() {

}


main()
