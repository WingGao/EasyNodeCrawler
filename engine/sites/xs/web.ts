import wiki from 'wikijs';
import { getLogger } from "log4js";
import { initDB, pageRepo, PageResult, Person, SrcType } from "./mod";
import { EntityManager, getMongoRepository } from 'typeorm';
import axios, { AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import _ = require("lodash");

const logger = getLogger();
logger.level = 'debug';
let manager: EntityManager


async function searchWiki(person: Person) {
    let tag =`[${person}][searchWiki]`
  let res = await pageRepo.findByUserType(person.id, SrcType.Wiki)
  if (res.length > 0) {
    logger.info(`${tag} 已有${res.length}`)
    return
  }
  // https://www.npmjs.com/package/wikijs
  await wiki({ apiUrl: 'https://zh.wikipedia.org/w/api.php' })
    .page(person.cnName)
    // .then(page => page.info('alterEgo'))
    .then(async (page) => {
        // @ts-ignore
        if(page.raw.pageprops.disambiguation != null){
            //设置个歧义页面
            logger.error(`${tag} 有歧义 ${page.raw.fullurl}`)
            return
        }
      //TODO 多页查询
      let pr = new PageResult()
      pr.personId = person.id
      pr.srcType = SrcType.Wiki;
      pr.url = page.url();
      pr.contentPre = JSON.stringify(await page.content())
      pr.html = await page.html()
      logger.info(page)
      let res = await getMongoRepository(PageResult).updateOne({ url: pr.url }, { $set: pr }, { upsert: true })
      logger.info(res)
    }).catch(e=>{
        if(e.message == 'No article found'){
            logger.error(`${tag} 无法找到`)
        }else{
            throw e
        }
      }); // Bruce Wayne
}

async function searchBaiduWiki(person: Person) {
    let tag =`[${person}][searchBaiduWiki]`
  let res = await pageRepo.findByUserType(person.id, SrcType.BaiduWiki)
  if (res.length > 0) {
    logger.info(`${tag} 已有${res.length}`)
    return
  }
  let pUrl = `https://baike.baidu.com/item/${encodeURIComponent(person.cnName)}`
    return fetchUrl(person,{
        url: pUrl,
        onResponse:async(rep,pr,$)=>{
            let poly = $('.polysemant-list-lemma-title')
            if(poly.length > 0){
                logger.error(`${tag} 有歧义 ${pUrl} ${poly.text()} `)
                return false
            }
            pr.srcType = SrcType.BaiduWiki;
            return true
        },
    })
}
interface IFetchUrlConfig {
    url:string,
    onResponse?: (rep:AxiosResponse<any>,pr:PageResult,$:cheerio.CheerioAPI)=>Promise<boolean>
    checkExist?: boolean //默认true
}
async function fetchUrl(person:Person,config:IFetchUrlConfig){
    config = _.merge({checkExist:true},config)
    if(config.checkExist){
        let res = await pageRepo.find({personId:person.id,url:config.url})
        if (res.length > 0) {
            logger.info(`[${person}][fetchUrl] 已有${res.length}`)
            return
        }
    }
    logger.info('fetchUrl', config.url)
    let rep = await axios.get(config.url)
    let pr = new PageResult()
    pr.personId = person.id
    pr.url = config.url;
    pr.html = rep.data
    let $ = cheerio.load(pr.html)
    pr.contentPre = $('body').text()
    let canAdd = true
    if(config.onResponse) canAdd=await config.onResponse(rep,pr,$ as any)
    if(canAdd) {
        logger.info('fetchUrl add', pr)
        await pageRepo.upsertByUrl(pr)
    }
}

async function searchName(name) {
  let person = await manager.findOne(Person, { cnName: name })
  if (person == null) {
    person = new Person()
    person.cnName = name
    await manager.save(person)
  }
  await Promise.all([
    searchWiki(person), searchBaiduWiki(person)
  ])

}

async function main() {
  manager = await initDB()
  // await searchName('饶毅')
  // await searchName('王晓东')
  await searchName('杨朝勇')
}

main()
