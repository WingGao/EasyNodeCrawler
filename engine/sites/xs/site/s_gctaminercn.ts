import axios from "axios";
import { GoogleResultParser } from "./google_result";
import {
    doWithProcessStep,
    GTC_TYPE,
    IGctPublish,
    PageResult,
    Person,
    personRepo,
    personRepoExt, processRepoExt, ProcessStep,
    Publish,
    PublishAuthor,
    publishRepo, publishRepoExt
} from "../mod";
import _ = require("lodash");
import stringSimilarity = require("string-similarity");
import { getLogger } from "../../../core/utils";
import { OrgMap } from "../mod/org";
import inquirer = require('inquirer');
import Redis from "../../../core/redis";

const logger = getLogger('GctAminer');
export default class GctAminer extends GoogleResultParser {
    // 弃用
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
        let searchName = _.defaultTo(person.cnName, person.enName)
        let surl = `https://innovaapi.aminer.cn/tools/v1/GCT/experts?q=${encodeURIComponent(searchName)}&offset=0&size=10&creator=false`
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
                if (person.cnName != null && person.cnName != cnName) {
                    return false // 中文名不相同
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
                        gct: GTC_TYPE.MATCHED,
                        gctInfo: person.gctInfo
                    })
                } else {
                    // 标记无结果
                    await personRepo.update(person.id as any, {
                        gct: GTC_TYPE.NO_RESULT,
                    })
                }
            }
        }
    }

    static async fetchDetail(person: Person) {
        if (person.gctInfo == null) return false
        if (person.gctDetail != null) return true
        let gtcInfo = JSON.parse(person.gctInfo)
        let surl = `https://apiv2.aminer.cn/magic_${gtcInfo.id}`
        let jdata = [{
            "action": "personapi.get", "parameters": { "ids": [gtcInfo.id] },
            "schema": { "person": ["id", "name", "name_zh", "avatar", "num_view", "is_follow", "work", "hide", "nation", "language", "bind", "acm_citations", "links", "educations", "tags", "tags_zh", "num_view", "num_follow", "is_upvoted", "num_upvoted", "is_downvoted", "is_lock", { "indices": ["hindex", "pubs", "citations"] }, { "profile": ["position", "position_zh", "affiliation", "affiliation_zh", "work", "gender", "lang", "homepage", "phone", "email", "fax", "bio", "bio_zh", "edu", "address", "note", "homepage", "titles"] }] }
        }]
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
        person.gctDetail = page.data[0].data[0]
        await personRepo.update(person.id as any, {
            gctDetail: person.gctDetail
        })
    }

    // 合作关系
    static async fetchNet(person: Person) {
        if (person.gctDetail == null) return true

        // https://apiv2.aminer.cn/n?a=GetEgoNetworkGraph__personapi.GetEgoNetworkGraph___
        let params = [{
            "action": "personapi.GetEgoNetworkGraph",
            "parameters": { "id": "54409444dabfae7d84b85f0e", "reloadcache": true }
        }]
    }

    // 成果

    static async fetchPublish(person: Person) {
        if (person.gctDetail == null) return
        let pageIdx = 0
        let pageSize = 50
        while (true) {
            let params = [{
                "action": "person.GetPersonPubs",
                "parameters": {
                    "offset": pageIdx * pageSize,
                    "size": pageSize,
                    "sorts": ["!year"],
                    "ids": [person.gctDetail.id],
                    "searchType": "all"
                },
                "schema": {
                    "publication": ["id", "year", "title", "title_zh", "authors._id", "authors.name", "authors.name_zh", "num_citation", "venue.info.name", "venue.volume", "venue.info.name_zh", "venue.issue", "pages.start", "pages.end", "lang", "pdf", "doi", "urls", "versions"]
                }
            }]
            let paramsJs = JSON.stringify(params)
            let surlKey = Redis.buildKeyMd5('', paramsJs)
            let surl = `https://apiv2.aminer.cn/magic_GetPersonPubs_${surlKey}`
            let pageLen = 0
            let step = new ProcessStep()
            step.tag = surl
            step.personId = person.id
            await doWithProcessStep(step, async () => {
                let { page, useCache } = await GoogleResultParser.fetchUrl(surl, {
                    axios: () => axios.post("https://apiv2.aminer.cn/magic?a=GetPersonPubs__person.GetPersonPubs___", paramsJs, {
                        headers: {
                            Origin: 'https://top3-talent.com',
                            Accept: '*/*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:80.0) Gecko/20100101 Firefox/80.0',
                            "content-type": "text/plain;charset=UTF-8",
                        }
                    })
                })
                let items = page.data[0].items
                if (items == null) return
                pageLen = items.length
                logger.info("fetchPublish ", pageLen)
                let saveList = []
                for (const item of items as Array<IGctPublish>) {
                    let pub = new Publish()
                    pub.gctJson = JSON.stringify(item)
                    pub.doi = item.doi
                    // 检查是否重复
                    let exDoi = await publishRepoExt.checkDoi(item.doi)
                    if (exDoi != null) {
                        logger.error('重复DOI', exDoi, item.title)
                        continue
                    }
                    pub.title = item.title
                    pub.gctId = item.id
                    pub.year = item.year
                    pub.numCitation = item.num_citation
                    pub.authors = []
                    if (item.authors != null) {
                        for (const au of item.authors) {
                            let pa = new PublishAuthor
                            pa.name = au.name
                            pa.gctId = au.id
                            if (pa.gctId != null) {
                                // 先判断是不是自己
                                if (person.gctDetail.id == pa.gctId) pa.pid = person.id
                                else {
                                    // 找到对应的person
                                    let exPersonId = await this.getPersonId(pa.gctId)
                                    if (exPersonId != null) pa.pid = exPersonId
                                }
                            }
                            pub.authors.push(pa)
                        }
                    }
                    logger.info(`find ${pub.title}`)
                    saveList.push(publishRepo.save(pub).catch(e => 1))
                }
                await Promise.all(saveList)
            })
            if (pageLen < pageSize) {
                break //到头
            }
            pageIdx++
        }
        // 标记完成
        await personRepo.update(person.id as any, {
            gctPublishFlag: 1
        })
    }

    static async getPersonId(gctId: string) {
        let res = await personRepo.findOne({
            select: ['id'],
            where: { 'gctDetail.id': gctId }
        })
        return res?.id
    }

    static async parseEdu(person: Person) {
        if (person.gctDetail == null|| (person.gctEx != null) ) return
        let parseBr = (html)=>{
            if(html == null) return
            return html.split(/<br\/?>/i).map(v=>v.trim()).filter(v=>v.length>0)
        }
        let eduList = parseBr(person.gctDetail.profile.edu)
        let workList = parseBr(person.gctDetail.profile.work)
        await personRepo.updateOne({ _id: person.id }, { $set: { gctEx: { eduList, workList } } })
        return [eduList, workList]
    }

    parseItemPost(person: Person, item: PageResult): Promise<PageResult> {
        return Promise.resolve(undefined);
    }
}
