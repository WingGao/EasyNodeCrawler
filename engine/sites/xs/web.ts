import wiki from 'wikijs';
import { getLogger } from "log4js";

const logger = getLogger();
logger.level ='debug';




async function searchWiki(name){
  // https://www.npmjs.com/package/wikijs
  await wiki({ apiUrl: 'https://zh.wikipedia.org/w/api.php' })
    .page(name)
    // .then(page => page.info('alterEgo'))
    .then(async (page)=>{
      let ctx = await page.content()
      let html = await page.html()
      logger.info(page)
    }); // Bruce Wayne
}

async function searchName(name){
  await searchWiki(name)
}

searchName('饶毅')
