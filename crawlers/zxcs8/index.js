const { Post } = require('./models')
const request = require('request')
const _ = require('lodash')
const cheerio = require('cheerio')
const Queue = require('promise-queue')
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug'

function fetchRank(pid) {
    return new Promise((resolve, reject) => {
        logger.info('[fetchRank]', pid)
        request(`http://www.zxcs8.com/content/plugins/cgz_xinqing/cgz_xinqing_action.php?action=show&id=${pid}`, function (error, response, body) {
            if (error != null) {
                logger.error('[fetchRank-error]', pid, error)
                reject()
                return
            }
            let statusCode = _.get(response, 'statusCode')
            if (statusCode !== 200) {
                logger.error('[fetchRank-error]', pid, `code=${statusCode}`)
                reject()
                return
            }

            let ranks = body.split(',')
            let post_rank = {}
            ranks.forEach((v, i) => {
                post_rank[`rank_${i + 1}`] = parseInt(v)
            })
            Post.update(post_rank, { where: { pid: pid } }).then(() => resolve(pid))
        });
    })
}

function fetchPost(pid) {
    return new Promise((resolve, reject) => {
        logger.info('[fetchPost]', pid)
        request(`http://www.zxcs8.com/post/${pid}`, function (error, response, body) {
            if (error != null) {
                logger.error('[fetchPost-error]', pid, error)
                reject()
                return
            }
            let statusCode = _.get(response, 'statusCode')
            if (statusCode !== 200) {
                logger.error('[fetchPost-error]', pid, `code=${statusCode}`)
                reject()
                return
            }

            let _fetch = () => {
                const $ = cheerio.load(body)
                const content = $('#content')
                let post_title = content.find('h1').text()
                let post = {
                    pid: pid,
                    post_title: post_title,
                    book_name: post_title.match(/《(.*?)》/)[1],
                    category: content.find('p.date a').slice(1).eq(0).text(),
                }

                Post.create(post).then(mpost => {
                    logger.info('[fetchPost]', `post ${pid} created`)
                    resolve(pid)
                })
            }
            //先检查是否存在
            Post.findOne({ where: { pid: pid } }).then(post => {
                if (post != null) {
                    logger.error('[fetchPost-error]', `post ${pid} existed`)
                    reject()
                } else {
                    _fetch()
                }
            })
        });
    })
}

function main() {
    let doNothing = () => null
    fetchPost(10700).then(pid => fetchRank(pid), doNothing)
        .then(pid => logger.log('[done]', pid), doNothing)
}

main()