import { GoogleResultParser } from "./google_result";
import { PageResult, Person, SrcType } from "../mod";
import { getLogger } from "../../../core/utils";

const logger = getLogger('GoogleResultParserCAS');


export const CAS_ORG = "Chinese Academy of Sciences"

export class GoogleResultParserCAS extends GoogleResultParser {
    static Type = SrcType.Ucas

    async parseItemPost(person: Person, item: PageResult): Promise<PageResult> {
        if (item.srcType == SrcType.Ucas) {
            logger.info('parseItem', item.url)
        }
        item.contentPre = item.html
        item._changed = true
        return item
    }
}
