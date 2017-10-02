const Sequelize = require('sequelize');
const db = require('../../config/db').db

const TABLE_PRE = 'bisige_'

const Post = db.define(TABLE_PRE + 'post', {
    pid: { type: Sequelize.DataTypes.INTEGER, unique: true },
    // create_time: Sequelize.DataTypes.TIME,
    title: Sequelize.DataTypes.STRING,
    category_name: Sequelize.DataTypes.STRING,
    download_url: Sequelize.DataTypes.STRING,
    is_downloaded: Sequelize.DataTypes.BOOLEAN,
    my_reply_page: Sequelize.DataTypes.INTEGER,//我的回复页数
    can_replay: Sequelize.DataTypes.BOOLEAN,//我有没有权限回复
}, { indexes: [{ fields: ['category_name'] }] })
/*
SELECT * from zxcs_posts WHERE rank_1 IS NOT NULL ORDER BY (rank_1+rank_2-rank_5) DESC
 */
Post.sync()

Post.findByPid = function (pid) {
    return this.findOne({ where: { pid: pid } })
}

module.exports = { Post }