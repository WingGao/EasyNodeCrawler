import { Entity, ObjectID, ObjectIdColumn, Column, getManager } from "typeorm";

@Entity()
export class Person {
    @ObjectIdColumn()
    id: ObjectID;

    @Column()
    cnName: string
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
}

export const SrcType = {
    Wiki: 'wiki'
}

import { createConnection, Connection } from "typeorm";

let connection: Connection

export async function initDB() {
    connection = await createConnection({
        type: "mongodb",
        host: "localhost",
        port: 27017,
        database: "xs",
        entities: [
            __dirname + "/*.ts"
        ]
    });
    return getManager();

}
