import axios from "axios";
import { GoogleResultParser } from "./google_result";
import { PageResult, Person, personRepo, personRepoExt } from "../mod";
import _ = require("lodash");
import stringSimilarity = require("string-similarity");
import { getLogger } from "../../../core/utils";
import { OrgMap } from "../mod/org";

const logger = getLogger('GctAminer');
export default class GctAminer extends GoogleResultParser {
    static async search(person: Person) {
        let surl = `https://innovaapi.aminer.cn/tools/v1/GCT/experts?q=${encodeURIComponent(person.enName)}&offset=0&size=10&creator=false`
        let { page, useCache } = await GoogleResultParser.fetchUrl(surl, {
            headers: {
                "referrer": "https://gct.aminer.cn/",
            }
        })
        let matchItem = _.find(page.data, (res: any) => {
            if (res.sourcetype != 'person') return false
            let cnName = res.name_zh
            logger.info('cnName', cnName)
            let ok = false
            if (person.cnName != null) {
                if (person.cnName == cnName) return true
            } else ok = GoogleResultParser.checkCnName(person.enName, cnName)
            if (!ok) return false
            let orgName = _.defaultTo(res.profile.affiliation, res.profile.affiliation_zh) as string
            let orgList = [person.org].concat(OrgMap[person.org])
            ok = _.find(orgList, v => orgName.indexOf(v) >= 0) != null
            // let orgSim = stringSimilarity.compareTwoStrings(person.org, res.profile.affiliation)
            // ok = orgSim > 0.9
            logger.info('org:', orgName)
            if (!ok) {
                return false
            }
            person.gctInfo = JSON.stringify(res)
            return true
        })

        if (matchItem != null) {
            await personRepo.update(person.id as any, {
                cnName: matchItem.name_zh,
                gct: 1,
                gctInfo: person.gctInfo
            })
        }
        return useCache
    }

    parseItemPost(person: Person, item: PageResult): Promise<PageResult> {
        return Promise.resolve(undefined);
    }
}
