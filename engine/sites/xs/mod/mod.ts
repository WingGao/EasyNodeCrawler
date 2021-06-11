import { Entity, ObjectIdColumn, Column, getManager, getMongoRepository, MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";
import { URL } from 'url';

@Entity()
export class Person {
    @ObjectIdColumn()
    id: ObjectID;

    @Column()
    cnName: string

    @Column()
    enName: string

    @Column()
    org: string

    @Column()
    google: number // 1=谷歌搜索完毕

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
    personId: ObjectID
    @Column()
    googleDesc: string
    @Column() // 搜索结果中的位置
    googleIdx: number
    @Column()
    title: string
    @Column()
    mark: number
    @Column()
    parsedResult: any

    _changed:boolean
}

export const SrcType = {
    WikiEn: 'wiki-en',
    WikiZh: 'wiki-zh',
    BaiduWiki: 'baidu-wiki',
    GoogleScholar: 'google-scholar',
    Ucas: 'ucas', // http://people.ucas.ac.cn
}

import { createConnection, Connection } from 'typeorm';

let connection: Connection
export let pageRepo: MongoRepository<PageResult> & IPageRepoExt
export let personRepo: MongoRepository<Person>

interface IPageRepoExt {
    findByUserType(personId: ObjectID, srcType: string): Promise<PageResult[]>

    upsertByUrl(p: PageResult): Promise<Boolean>
}

function extendPageResult() {
    pageRepo.findByUserType = (personId: ObjectID, srcType: string) => {
        return pageRepo.find({ personId, srcType })
    }
    pageRepo.upsertByUrl = async (pr: PageResult) => {
        let res = await pageRepo.updateOne({ url: pr.url }, { $set: pr }, { upsert: true })
        return res.upsertedCount > 0
    }
}

export function checkSrcType(url: string) {
    let u = new URL(url)
    switch (u.host) {
        case "en.wikipedia.org":
            return SrcType.WikiEn
        case "scholar.google.com":
            return SrcType.GoogleScholar
        case "people.ucas.ac.cn":
            return SrcType.Ucas
    }
    return undefined
}

function extendPerson() {

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
    extendPerson()
    return getManager();
}
