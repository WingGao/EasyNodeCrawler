import axios from "axios";
import cheerio from "cheerio";
import { GoogleResultParser } from "./google_result";
import {
    doWithProcessStep,
    GTC_TYPE,
    IGctPublish, pageRepo,
    PageResult,
    Person,
    personRepo,
    personRepoExt, processRepoExt, ProcessStep,
    Publish,
    PublishAuthor,
    publishRepo, publishRepoExt, SrcType, TianyanBoss, TianyanCompany
} from "../mod";
import _ = require("lodash");
import { getLogger, sleep, TimeLimiter } from "../../../core/utils";
import { OrgMap } from "../mod/org";
import inquirer = require('inquirer');
import Redis from "../../../core/redis";


const logger = getLogger('Tianyan');
// 天眼查
export default class TianyanCha extends GoogleResultParser {
    cookie = `TYCID=a711cdf0e48411eb8f6471a3c8ce9868; ssuid=5478678406; _ga=GA1.2.326029687.1626254399; aliyungf_tc=e04921a33c5a127b26d36efa6f667212931aec4516851535a4409747d8f573e0; csrfToken=ZpsdG6dPxdaU5TTpwCi8IVyM; jsid=SEO-GOOGLE-ALL-SY-000001; bannerFlag=true; show_activity_id_16=16; bad_id658cce70-d9dc-11e9-96c6-833900356dc6=b5d5c051-04bc-11ec-b406-811e0c9b6895; nice_id658cce70-d9dc-11e9-96c6-833900356dc6=b5d5c052-04bc-11ec-b406-811e0c9b6895; Hm_lvt_e92c8d65d92d534b0fc290df538b4758=1629796910; _gid=GA1.2.819256428.1629796911; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%2218610009981%22%2C%22first_id%22%3A%2217aa450cfba3eb-0ae1c7ca9689cc-6373264-3686400-17aa450cfbbc3b%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E8%87%AA%E7%84%B6%E6%90%9C%E7%B4%A2%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC%22%2C%22%24latest_referrer%22%3A%22https%3A%2F%2Fwww.google.com%2F%22%7D%2C%22%24device_id%22%3A%2217aa450cfba3eb-0ae1c7ca9689cc-6373264-3686400-17aa450cfbbc3b%22%7D; tyc-user-phone=%255B%252218610009981%2522%255D; tyc-user-info={%22state%22:5%2C%22vipManager%22:%220%22%2C%22mobile%22:%2218610009981%22}; tyc-user-info-save-time=1629799313224; auth_token=eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxODYxMDAwOTk4MSIsImlhdCI6MTYyOTc5NzAzMiwiZXhwIjoxNjYxMzMzMDMyfQ.wiCJ3rbMNKG3jxi3GZsedq7WtIqYDHMm8VBbdWux4CishFLQYlQXCOJtufGyz2bxtW3fCRbWraoDGFObP9e6PA; searchSessionId=1629806305.15166521; acw_tc=781bad0c16298063058701453e759fcb15712195a6e5543448b95853cbea28; searchV6CompanyResultName=%E5%AE%89%E8%8A%B7%E7%94%9F; searchV6CompanyResultName.sig=uHS4d0Q2ckGWqroZvJddp8jsxkE7o5ZlaYfmFgso7MQ; Hm_lpvt_e92c8d65d92d534b0fc290df538b4758=1629806449`

    inst = axios.create({
        headers: {
            "referrer": "https://www.tianyancha.com",
            'Cookie': this.cookie,
        }
    })
    timeLimiter = new TimeLimiter(10000)

    async fetchHumanResultPage(person: Person, humanSearchId) {
        let resultUrl = `https://www.tianyancha.com/human/${humanSearchId}`
        let pageRes = await pageRepo.findByUrl(resultUrl)
        if (pageRes != null) return pageRes

        // 控制间隔
        await this.timeLimiter.wait()

        let repResult = await this.inst.get(resultUrl)
        pageRes = new PageResult()
        pageRes.srcType = SrcType.TianyanSearch
        pageRes.url = resultUrl
        pageRes.personId = person.id
        pageRes.html = repResult.data
        await pageRepo.save(pageRes)
        await this.parseHumanResultPage(pageRes)
        return pageRes
    }


    async parseHumanResultPage(pageRes: PageResult, check = false) {
        if (pageRes.parsedResult != null) return

        let $ = cheerio.load(pageRes.html)
        let humanList$ = $('.result-human-list')
        if (humanList$.length == 0) {
            // 需要删除,大概率是验证
            await pageRepo.deleteOne({ _id: pageRes.id })
            debugger // 有问题
            return
        }
        if (check && pageRes.parsedResult == null) {
            let bossList = []
            humanList$.find('.slider-boss').each((i, dom: any) => {
                let $dom = $(dom)
                let boss = new TianyanBoss()
                boss.urlKey = $dom.attr('data-id')
                boss.companyList = []
                $dom.find('.bottom .company-name').each((j, compName: any) => {
                    let $compName = $(compName)
                    let company = new TianyanCompany()
                    company.name = $compName.attr('title')
                    company.urlKey = _.last($compName.attr('href').split('/'))
                    boss.companyList.push(company)
                })
                bossList.push(boss)
            })
            pageRes.parsedResult = JSON.stringify(bossList)
            await pageRepo.update({ id: pageRes.id }, { parsedResult: pageRes.parsedResult })
        }

        logger.info($("#search").text().trim())
    }

    // 查询，并选择UI
    async searchUI(person: Person) {
        if (_.size(person.cnName) == 0) return //必须有中文名

        let keyUrl = `https://www.tianyancha.com/human/getHidByName.json?name=${encodeURIComponent(person.cnName)}`
        let { page, useCache } = await GoogleResultParser.fetchUrl(keyUrl, {
            axios: async () => {
                let rep = await this.inst.get(keyUrl)
                if (rep.data.data == null) {
                    logger.warn(rep.data)
                } else {
                    await this.fetchHumanResultPage(person, rep.data.data.id)
                }
                return { data: 'ok' }
            },
        })
        return page
    }

    exportToExcel() {
        return {
            headers: ['personId', 'name', 'company'],
            onRow: async (person: Person) => {
                let pageRes = await pageRepo.findOne({ personId: person.id, srcType: SrcType.TianyanSearch })
                if (pageRes == null) return
                await this.parseHumanResultPage(pageRes, true)
                let res = JSON.parse(pageRes.parsedResult) as Array<TianyanBoss>
                let rows = []
                _.forEach(res, boss => {
                    boss.companyList.forEach(company => {
                        rows.push([person.id.toHexString(), person.cnName, company.name])
                    })
                })
                return rows
            }
        }
    }

    parseItemPost(person: Person, item: PageResult): Promise<PageResult> {
        return Promise.resolve(undefined);
    }
}
