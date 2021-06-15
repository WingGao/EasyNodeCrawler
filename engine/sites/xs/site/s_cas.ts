import { GoogleResultParser } from "./google_result";
import { PageParsedInfo, PageResult, Person, personRepoExt, SrcType } from "../mod";
import { getLogger } from "../../../core/utils";
import { load } from "cheerio";
import { OrgMap } from "../mod/org";


const logger = getLogger('GoogleResultParserCAS');


export const CAS_ORG = OrgMap["Chinese Academy of Sciences"]


export class GoogleResultParserCAS extends GoogleResultParser {
    static Type = SrcType.Ucas

    async parseItemPre(person: Person, item: PageResult) {
        if (person.orgPage1Id != null) {
            item._changed = false
            return false
        }
        item.url = item.url.split('?')[0]
        return true
    }

    /**
     * 示例 http://people.ucas.ac.cn/~xhbao
     */
    async parseItemPost(person: Person, item: PageResult): Promise<PageResult> {
        if (item.srcType == SrcType.Ucas) {
            logger.info('parseItem', item.url)
        }
        let $ = load(item.html)
        let cnName = $('.bp-enty').text().trim().split(/[\s，]/)[0]
        logger.info('cnName', cnName)
        let skip = !GoogleResultParser.checkCnName(person.enName, cnName)
        if (skip) return item;
        await personRepoExt.updateCnName(person, cnName, true)
        await personRepoExt.updateOrgPage(person, item.id as any)
        let pr = new PageParsedInfo()
        $('.m-itme').each((i, dom) => {
            let $dom = $(dom as any)
            let h3 = $dom.find('.mi-t').text().trim()
            let span = $dom.find('.mi-box').text().trim()
            switch (h3) {
                case '个人简介':
                    pr.pInfo = span
                    break
                case '研究领域':
                    pr.researchField = span
                    break
                case '教育背景':
                    pr.educational = span
                    break
                case '工作经历':
                    pr.workExperience = span
                    break
                case '专利与奖励':
                    pr.awards = span
                    break
                case '出版信息':
                case '代表性论著':
                    pr.publication = span
                    break
                case '科研活动':
                case '主要科研项目':
                    pr.researchActivity = span
                    break
            }
        })
        item.parsedResult = JSON.stringify(pr)
        item._changed = true
        return item
    }
}
