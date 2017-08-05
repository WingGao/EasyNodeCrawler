const { Post } = require('./models')
const request = require('request')
const _ = require('lodash')
const cheerio = require('cheerio')
const Queue = require('promise-queue')
const numeral = require('numeral')
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug'
const argv = require('yargs').argv
const fs = require('fs')
const path = require('path')


function fetchRank(pid) {
    return new Promise((resolve, reject) => {
        logger.info('[fetchRank]', pid)
        request(`http://www.zxcs8.com/content/plugins/cgz_xinqing/cgz_xinqing_action.php?action=show&id=${pid}`, function (error, response, body) {
            if (error != null) {
                logger.error('[fetchRank-error]', pid, error)
                reject(pid)
                return
            }
            let statusCode = _.get(response, 'statusCode')
            if (statusCode !== 200) {
                logger.error('[fetchRank-error]', pid, `code=${statusCode}`)
                reject(pid)
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
                reject(pid)
                return
            }
            let statusCode = _.get(response, 'statusCode')
            if (statusCode !== 200) {
                logger.error('[fetchPost-error]', pid, `code=${statusCode}`)
                reject(pid)
                return
            }

            let _fetch = () => {
                const $ = cheerio.load(body)
                const content = $('#content')
                let post_title = content.find('h1').text()
                let bookname = _.get(post_title.match(/《(.*?)》/), '1')
                if (bookname == null) {
                    logger.error('[fetchPost-error]', pid, 'no bookname', post_title)
                    reject(pid)
                    return
                }

                let post = {
                    pid: pid,
                    post_title: post_title,
                    book_name: bookname,
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
            }).catch(err => {
                logger.error('[fetchPost-error]', err)
                reject(pid)
            })
        });
    })
}

function fetchDownloadLink(pid) {
    return new Promise((resolve, reject) => {
        logger.info('[fetchDownloadLink]', pid)
        request(`http://www.zxcs8.com/download.php?id=${pid}`, function (error, response, body) {
            if (error != null) {
                logger.error('[fetchDownloadLink-error]', pid, error)
                reject(pid)
                return
            }
            let statusCode = _.get(response, 'statusCode')
            if (statusCode !== 200) {
                logger.error('[fetchDownloadLink-error]', pid, `code=${statusCode}`)
                reject(pid)
                return
            }

            const $ = cheerio.load(body)
            const link = $('.panel-body .downfile a').eq(0).attr('href')
            Post.update({ download_url: link, is_downloaded: false }, { where: { pid: pid } })
                .then(() => resolve(pid))
        });
    })
}

const DOWNDIR = path.resolve(__dirname, '../../datas/zxcw8')

function downloadBook(pid) {
    return new Promise((resolve, reject) => {
        logger.info('[downloadBook]', pid)
        Post.findOne({ where: { pid: pid } }).then(post => {
            let newFile = path.join(DOWNDIR, `${pid}-${_.last(post.download_url.split('/'))}`)
            request(post.download_url, function (error, response, body) {
                let statusCode = _.get(response, 'statusCode')
                if (statusCode !== 200) {
                    logger.error('[downloadBook-error]', pid, `code=${statusCode}`)
                    reject(pid)
                    return
                }

                Post.update({ is_downloaded: true }, { where: { pid: pid } })
                    .then(() => resolve(pid))
            }).pipe(fs.createWriteStream(newFile))
        })
    })
}

function getMaxPid() {
    return new Promise((resolve, reject) => {
        request(`http://www.zxcs8.com/map.html`, function (error, response, body) {
            if (error != null) {
                logger.error('[getMaxPid-error]', error)
                reject()
                return
            }

            const $ = cheerio.load(body)
            let maxPid = $('#content a').attr('href').match(/\/(\d+)/)[1]
            logger.info('max pid', maxPid)
            resolve(parseInt(maxPid))
        })
    })
}


function main() {
    let doNothing = () => null

    let currentIndex = -1
    let beginPid = 4786
    let queryList
    let maxConcurrent = 6
    let delay = 1000
    let taskDelay = 100

    let _next = () => {
        if (currentIndex < queryList.length) {
            let nextPid = queryList[++currentIndex]
            setTimeout(() => {
                nextPromise(nextPid)
            }, delay)
        }
    }

    let nextPromise = (pid) => {
        return fetchPost(pid)
            .then(pid => fetchRank(pid), (pid) => _next())
            .then(pid => {
                if (pid == null) return
                logger.info('[done]', pid)
                _next()
            }, doNothing)
    }

    //获取下载地址Promise
    let nextPromiseFL = (pid) => {
        if (pid == null) pid = queryList[++currentIndex]
        if (pid == null) return
        setTimeout(() => {
            logger.info('[process]', `${currentIndex}/${queryList.length} (${numeral(currentIndex / queryList.length).format('0.000%')})`)
            fetchDownloadLink(pid).then(() => nextPromiseFL(), () => nextPromiseFL())
        }, delay)
    }

    //获取下载书籍Promise
    let nextPromiseDown = (pid) => {
        if (pid == null) pid = queryList[++currentIndex]
        if (pid == null) return
        setTimeout(() => {
            logger.info('[process]', `${currentIndex}/${queryList.length} (${numeral(currentIndex / queryList.length).format('0.000%')})`)
            downloadBook(pid).then(() => nextPromiseDown(), () => nextPromiseDown())
        }, delay)
    }
    if (argv.fl) {
        //只获取下载链接
        Post.findAll({
            attributes: ['pid'],
            where: { download_url: null }
        }).then(pids => {
            queryList = _.map(pids, v => v.pid)
            logger.info('total post', queryList.length)
            for (let i = 0; i < maxConcurrent; i++) {
                setTimeout(() => {
                    nextPromiseFL(queryList[++currentIndex])
                }, taskDelay * i)
            }
        })
    } else if (argv.d) {
        //下载书籍
        Post.findAll({
            attributes: ['pid'],
            where: { is_downloaded: false, download_url: { $ne: null } }
        }).then(pids => {
            queryList = _.map(pids, v => v.pid)
            logger.info('total post', queryList.length)
            for (let i = 0; i < maxConcurrent; i++) {
                setTimeout(() => {
                    nextPromiseDown(queryList[++currentIndex])
                }, taskDelay * i)
            }
        })
    } else {
        getMaxPid().then(mpid => {
            queryList = _.range(beginPid, mpid)
            for (let i = 0; i < maxConcurrent; i++) {
                setTimeout(() => {
                    nextPromise(queryList[++currentIndex])
                }, taskDelay * i)
            }
        })
    }
}

main()
