import { Entity, ObjectIdColumn, Column } from "typeorm";
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
    gctDetail: IGctDetail //gtc爬取的详细信息
    @Column()
    gctEx: IGctEx //额外的信息，自己处理过的

    @Column()
    gctPublishFlag: number //是否爬取过出版物

    toString() {
        return `Person{id=${this.id},cnName=${this.cnName},enName=${this.enName},org=${this.org}}`
    }
}

interface IGctDetail {
    id: string;
    name: string
    name_zh: string
    profile: {
        edu: string,
        work: string
    }

    [key: string]: any
}

interface IGctEx {
    eduList: Array<string>
    workList: Array<string>
}

export const GTC_TYPE = {
    NOT_SEARCH: 0,
    MATCHED: 1,
    NO_RESULT: 2,//没有结果
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
    @Column()
    personId: ObjectID //相关联的人物id

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
    EduCn: 'edu-cn',
    TianyanSearch: 'tyc-search'
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

// 出版物
@Entity()
export class Publish {
    @ObjectIdColumn()
    id: ObjectID;
    @Column()
    title: string
    @Column()
    authors: Array<PublishAuthor>
    @Column()
    doi: string
    @Column()
    year: number
    @Column()
    numCitation: number //应用次数
    @Column()
    gctId: string
    @Column()
    gctJson: string
}

export interface IGctPublish {
    id: string
    doi: string
    title: string
    year: number
    num_citation: number
    authors: Array<any>

    [key: string]: any
}

export class PublishAuthor {
    name: string
    gctId: string
    pid: ObjectID
}

// 处理进度
@Entity()
export class ProcessStep {
    @ObjectIdColumn()
    id: ObjectID;
    @Column()
    tag: string
    @Column()
    personId: ObjectID
}

export class TianyanBoss {
    urlKey: string
    companyList: Array<TianyanCompany>
}

export class TianyanCompany {
    urlKey: string
    name: string
}
