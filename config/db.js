const Sequelize = require('sequelize')
const path = require('path')

const sequelize = new Sequelize('database', 'username', 'password', {
    dialect: 'sqlite',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    },
    // SQLite only
    storage: path.join(__dirname, '../datas/db.sqlite'),
    logging() {

    },
});
const KV = sequelize.define('kv', {
    key: { type: Sequelize.DataTypes.STRING, unique: true },
    value: Sequelize.DataTypes.STRING,
})

KV.findByKey = function (key) {
    return this.findOne({ where: { key: key } })
}

KV.sync()

module.exports = { db: sequelize, KV }