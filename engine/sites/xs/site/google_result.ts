import { PageResult, Person } from "../mod";
import axios from "axios";
import stringSimilarity = require("string-similarity");
import pinyin = require("pinyin");
import Redis from "../../../core/redis";
import { getLogger } from "../../../core/utils";
import _ = require("lodash");

const logger = getLogger('GoogleResultParser');

export abstract class GoogleResultParser {
    static async fetchUrl(url: string, conf?) {
        let useCache = true
        let cacheKey = Redis.buildKeyMd5('node_xs:cache:', url)
        let page: any = await Redis.setIfNull(cacheKey, async () => {
            useCache = false;
            logger.debug('fetchUrl', url, cacheKey)
            let res
            if(conf != null && conf.axios){
                res = await conf.axios()
            }else {
                res = await axios.get(url, _.merge({
                    headers: {
                        Accept: '*/*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0'
                    }
                }, conf))
            }
            return res.data
        })
        return { page, useCache }
    }

    // 判断中文名是否正确
    static checkCnName(enName, cnName) {
        let pys = pinyin(cnName, { style: pinyin.STYLE_NORMAL }).map(v => v[0])
        let py = pys.join(' ')
        let nameSim = stringSimilarity.compareTwoStrings(py, enName.toLowerCase())
        if (nameSim < 0.8 || !enName.toLowerCase().startsWith(pys[0])) {
            return false
        } else {
            // debugger
        }
        return true
    }

    async parseItemPre(person: Person, item: PageResult) {
        return true
    }

    async parseItem(person: Person, item: PageResult) {
        if (await this.parseItemPre(person, item)) {
            if (item.html == null) {
                let r = await GoogleResultParser.fetchUrl(item.url)
                item.html = r.page
            }
            return this.parseItemPost(person, item)
        }
    }

    abstract parseItemPost(person: Person, item: PageResult): Promise<PageResult>
}
