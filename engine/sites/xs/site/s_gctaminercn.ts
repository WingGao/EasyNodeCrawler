import axios from "axios";
import { GoogleResultParser } from "./google_result";
import { PageResult, Person, personRepo, personRepoExt } from "../mod";
import _ = require("lodash");
import stringSimilarity = require("string-similarity");
import { getLogger } from "../../../core/utils";
import { OrgMap } from "../mod/org";
import inquirer = require('inquirer');

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

    // 查询，并选择UI
    static async searchUI(person: Person) {
        let surl = `https://innovaapi.aminer.cn/tools/v1/GCT/experts?q=${encodeURIComponent(person.enName)}&offset=0&size=10&creator=false`
        let { page, useCache } = await GoogleResultParser.fetchUrl(surl, {
            headers: {
                "referrer": "https://gct.aminer.cn/",
            }
        })
        if (_.size(page.data) > 0) {
            let choices = []
            // 打印，并选择
            _.forEach(page.data, (res, i) => {
                let ok = false
                if (res.sourcetype != 'person') return false
                let cnName = res.name_zh
                if (person.cnName != null) {
                    if (person.cnName == cnName) return true
                } else ok = GoogleResultParser.checkCnName(person.enName, cnName)
                if (!ok) return false
                let profile = _.defaultTo(res.profile, {}) as any
                logger.info(`${choices.length + 1}) cnName=${cnName} en=${res.name}; ${profile.affiliation}; ${profile.affiliation_zh}`)
                choices.push(res)
            })
            if (choices.length > 0) {
                // 等待选择
                let cho = await inquirer.prompt([{
                    type: 'number', name: 'v', message: '请选择序号，0表示没有'
                }])
                if (cho.v != null && cho.v > 0) {
                    let choItem = choices[cho.v - 1]
                    // 更新
                    person.cnName = choItem.name_zh
                    person.gctInfo = JSON.stringify(choItem)

                    await personRepo.update(person.id as any, {
                        cnName: person.cnName,
                        gct: 1,
                        gctInfo: person.gctInfo
                    })
                } else {
                    // 标记选择
                    await personRepo.update(person.id as any, {
                        gct: 1,
                    })
                }
            }
        }
    }

    static async fetchDetail(person: Person) {
        if (person.gctInfo == null) return false
        if(person.gtcDetail != null) return true
        let gtcInfo = JSON.parse(person.gctInfo)
        let surl = `https://apiv2.aminer.cn/magic_${gtcInfo.id}`
        let jdata = [{"action":"personapi.get","parameters":{"ids":[gtcInfo.id]},
            "schema":{"person":["id","name","name_zh","avatar","num_view","is_follow","work","hide","nation","language","bind","acm_citations","links","educations","tags","tags_zh","num_view","num_follow","is_upvoted","num_upvoted","is_downvoted","is_lock",{"indices":["hindex","pubs","citations"]},{"profile":["position","position_zh","affiliation","affiliation_zh","work","gender","lang","homepage","phone","email","fax","bio","bio_zh","edu","address","note","homepage","titles"]}]}}]
        let { page, useCache } = await GoogleResultParser.fetchUrl(surl, {
            axios: () => axios.post("https://apiv2.aminer.cn/magic", JSON.stringify(jdata), {
                headers: {
                    Origin: 'https://top3-talent.com',
                    Accept: '*/*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0',
                    "content-type": "text/plain;charset=UTF-8",
                }
            })
        })
        person.gtcDetail = page.data[0].data[0]
        await personRepo.update(person.id as any, {
            gtcDetail: person.gtcDetail
        })
    }

    parseItemPost(person: Person, item: PageResult): Promise<PageResult> {
        return Promise.resolve(undefined);
    }
}
