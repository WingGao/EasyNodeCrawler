const Sequelize = require('sequelize');
const db = require('../../config/db').db

const TABLE_PRE = 'zxcs_'

const Post = db.define(TABLE_PRE + 'post', {
    pid: { type: Sequelize.DataTypes.INTEGER, unique: true },
    // create_time: Sequelize.DataTypes.TIME,
    post_title: Sequelize.DataTypes.STRING,
    category: Sequelize.DataTypes.STRING,
    book_name: Sequelize.DataTypes.STRING,
    download_url: Sequelize.DataTypes.STRING,
    is_downloaded: Sequelize.DataTypes.BOOLEAN,
    rank_1: Sequelize.DataTypes.INTEGER, //仙草
    rank_2: Sequelize.DataTypes.INTEGER, //粮草
    rank_3: Sequelize.DataTypes.INTEGER, //干草
    rank_4: Sequelize.DataTypes.INTEGER, //枯草
    rank_5: Sequelize.DataTypes.INTEGER, //毒草
})

Post.sync()

module.exports = { Post }