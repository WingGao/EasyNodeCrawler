import { Entity, ObjectIdColumn, Column, getManager, getMongoRepository, MongoRepository } from "typeorm";
import { URL } from 'url';
import { createConnection, Connection } from 'typeorm';
import Redis from "../../../core/redis";
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

    getCacheKey() {
        if (this.url == null) return null
        return Redis.buildKeyMd5('node_xs:cache:', this.url)
    }
}

export const SrcType = {
    WikiEn: 'wiki-en',
    WikiZh: 'wiki-zh',
    BaiduWiki: 'baidu-wiki',
    GoogleScholar: 'google-scholar',
    Ucas: 'ucas', // http://people.ucas.ac.cn
    EduCn: 'edu-cn'
}


let connection: Connection
export let pageRepo: MongoRepository<PageResult> & IPageRepoExt
export let personRepo: MongoRepository<Person>

interface IPageRepoExt {
    upsertByUrl(p: PageResult): Promise<ObjectID>

    resetHtml(id: string | ObjectID): Promise<Boolean>
}

function extendPageResult() {
    pageRepo.upsertByUrl = async (pr: PageResult) => {
        let res = await pageRepo.updateOne({ url: pr.url }, { $set: pr }, { upsert: true })
        if (res.upsertedId != null) pr.id = res.upsertedId._id as any
        else {
            let mat = await pageRepo.find({
                select: ['id'], where: { url: pr.url }
            })
            pr.id = mat[0].id
        }
        return pr.id
    }
    pageRepo.resetHtml = async (id: string) => {
        let r = await pageRepo.findOneAndUpdate({ _id: new ObjectID(id) },
            { $unset: { html: '', contentPre: '', parsedResult: '' } })
        let item = pageRepo.create(r.value as PageResult)
        await Redis.inst().del(item.getCacheKey())
        return true
    }
}

export function checkSrcType(url: string) {
    try {
        let u = new URL(url)
        switch (u.host) {
            case "en.wikipedia.org":
                return SrcType.WikiEn
            case "scholar.google.com":
                return SrcType.GoogleScholar
            case "people.ucas.ac.cn":
                return SrcType.Ucas
        }
        if (u.host.endsWith('.edu.cn')) {
            return SrcType.EduCn
        }
    } catch (e) {
        console.error(e)
    }
    return undefined
}

export const personRepoExt = {
    async updateCnName(person: Person, cnName: string, over = false) {
        if (person.cnName == null || over) {
            person.cnName = cnName
            await personRepo.update(person.id as any, { cnName })
            return true
        } else {
            return false
        }
    },
    updateOrgPage(person: Person, orgPage1Id: ObjectID) {
        return personRepo.update(person.id as any, { orgPage1Id })
    }
}


export class PageParsedInfo {
    pInfo: string // 个人简介
    researchField: string //研究领域
    educational: string //教育背景
    workExperience: string //工作经历
    awards: string //专利与奖励
    publication: string //出版信息
    researchActivity: string //科研活动
}


export async function initDB() {
    connection = await createConnection({
        type: "mongodb",
        host: "localhost",
        // host: "ubu.vm",
        port: 27017,
        database: "xs",
        entities: [
            __dirname + "/*.ts"
        ]
    });
    pageRepo = getMongoRepository(PageResult) as any
    extendPageResult()
    personRepo = getMongoRepository(Person)
    return getManager();
}
