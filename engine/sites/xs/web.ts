import wiki from 'wikijs';
import { getLogger } from "log4js";
import { initDB, PageResult, Person, SrcType } from "./mod";
import { EntityManager, getMongoRepository } from "typeorm";

const logger = getLogger();
logger.level = 'debug';
let manager: EntityManager


async function searchWiki(name) {
    // https://www.npmjs.com/package/wikijs
    await wiki({ apiUrl: 'https://zh.wikipedia.org/w/api.php' })
        .page(name)
        // .then(page => page.info('alterEgo'))
        .then(async (page) => {
            //TODO 多页查询
            let pr = new PageResult()
            pr.srcType = SrcType.Wiki;
            pr.url = page.url();
            pr.contentPre = await page.content()
            pr.html = await page.html()
            logger.info(page)
            let res = await getMongoRepository(PageResult).updateOne({url:pr.url},pr,{upsert:true})
            logger.info(res)
        }); // Bruce Wayne
}

async function searchName(name) {
    let person = await manager.findOne(Person, { cnName: name })
    if (person == null) {
        person = new Person()
        person.cnName = name
        await manager.save(person)
    }
    await searchWiki(name)
}

async function main() {
    manager = await initDB()
    await searchName('饶毅')
}

main()
