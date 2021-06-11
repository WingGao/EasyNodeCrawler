import { PageResult, Person } from "../mod";
import axios from "axios";
import Redis from "../../../core/redis";
import { getLogger } from "../../../core/utils";

const logger = getLogger('GoogleResultParser');

export abstract class GoogleResultParser {
    async fetchUrl(url: string) {
        let cacheKey = Redis.buildKeyMd5('node_xs:cache:', url)
        let page = await Redis.setIfNull(cacheKey, async () => {
            logger.debug('fetchUrl', url)
            let res = await axios.get(url)
            return res.data
        })
        return page
    }

    async parseItem(person: Person, item: PageResult) {
        if (item.html == null) {
            item.html = await this.fetchUrl(item.url)
        }
        return this.parseItemPost(person, item)
    }

    abstract parseItemPost(person: Person, item: PageResult): Promise<PageResult>
}
