import { Entity, ObjectIdColumn, Column} from "typeorm";
import { ObjectID } from "mongodb";

@Entity()
export class Person {
    @ObjectIdColumn()
    id: ObjectID;

    @Column()
    exId: number; //excel中的id

    @Column()
    cnName: string

    @Column()
    enName: string

    @Column()
    org: string

    @Column()
    orgCn: string

    @Column()
    google: number // 1=谷歌搜索完毕

    @Column()
    orgPage1Id: ObjectID //机构主页
    //谷歌搜索的结果
    @Column()
    googleResults: Array<ObjectID>

    @Column()
    gct: number // https://gct.aminer.cn/
    @Column()
    gctInfo: string //gtc的搜索json
    @Column()
    gtcDetail: any //gtc爬取的详细信息

    toString() {
        return `Person{id=${this.id},cnName=${this.cnName},enName=${this.enName},org=${this.org}}`
    }
}

@Entity()
export class PageResult {
    @ObjectIdColumn()
    id: ObjectID;
    @Column()
    url: string
    @Column()
    html: string
    @Column()
    contentPre: string
    @Column()
    srcType: string
    @Column()
    googleDesc: string
    @Column()
    title: string
    @Column()
    mark: number
    @Column()
    parsedResult: any
    @Column({ insert: false, update: false, select: false })
    _changed: boolean
    @Column({ insert: false, update: false, select: false })
    _fetchUrl: string //要爬取的地址
}

export const SrcType = {
    WikiEn: 'wiki-en',
    WikiZh: 'wiki-zh',
    BaiduWiki: 'baidu-wiki',
    GoogleScholar: 'google-scholar',
    Ucas: 'ucas', // http://people.ucas.ac.cn
    EduCn: 'edu-cn'
}

@Entity()
export class Org {
    @ObjectIdColumn()
    id: ObjectID;
    @Column()
    cn: string
    @Column()
    names: Array<string>
}
