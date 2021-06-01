import { Entity, ObjectIdColumn, Column, getManager, getMongoRepository, MongoRepository } from "typeorm";
import { ObjectID } from "mongodb";

@Entity()
export class Person {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  cnName: string

  toString() {
    return `Person{id=${this.id},cnName=${this.cnName}}`
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
}

export const SrcType = {
  Wiki: 'wiki',
  BaiduWiki: 'baidu-wiki'
}

import { createConnection, Connection } from 'typeorm';

let connection: Connection
export let pageRepo: MongoRepository<PageResult> & IPageRepoExt

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


export async function initDB() {
  connection = await createConnection({
    type: "mongodb",
    // host: "localhost",
    host: "ubu.vm",
    port: 27017,
    database: "xs",
    entities: [
      __dirname + "/*.ts"
    ]
  });
  pageRepo = getMongoRepository(PageResult) as any
  extendPageResult()
  return getManager();
}
