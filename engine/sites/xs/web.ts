import wiki from 'wikijs';
import { getLogger } from "log4js";
import { initDB, pageRepo, PageResult, Person, SrcType } from "./mod";
import { EntityManager, getMongoRepository } from 'typeorm';
import axios from "axios";
import * as cheerio from "cheerio";

const logger = getLogger();
logger.level = 'debug';
let manager: EntityManager


async function searchWiki(person: Person) {
  let res = await pageRepo.findByUserType(person.id, SrcType.Wiki)
  if (res.length > 0) {
    logger.info(`[${person}][searchWiki] 已有${res.length}`)
    return
  }
  // https://www.npmjs.com/package/wikijs
  await wiki({ apiUrl: 'https://zh.wikipedia.org/w/api.php' })
    .page(person.cnName)
    // .then(page => page.info('alterEgo'))
    .then(async (page) => {
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
    }); // Bruce Wayne
}

async function searchBaiduWiki(person: Person) {
  let res = await pageRepo.findByUserType(person.id, SrcType.BaiduWiki)
  if (res.length > 0) {
    logger.info(`[${person}][searchBaiduWiki] 已有${res.length}`)
    return
  }
  let pUrl = `https://baike.baidu.com/item/${encodeURIComponent(person.cnName)}`
  logger.info('searchBaiduWiki', pUrl)
  let rep = await axios.get(pUrl)
  let pr = new PageResult()
  pr.personId = person.id
  pr.srcType = SrcType.BaiduWiki;
  pr.url = pUrl;
  pr.html = rep.data
  let $ = cheerio.load(pr.html)
  pr.contentPre = $('body').text()
  logger.info('searchBaiduWiki add', pr)
  await pageRepo.upsertByUrl(pr)

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
  await searchName('饶毅')
}

main()
