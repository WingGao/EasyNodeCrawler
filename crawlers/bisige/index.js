const { KV } = require('../../config/db')
const { Post } = require('./models')
const _request = require('request')
const tough = require('tough-cookie');
const Iconv = require('iconv').Iconv;
const iconv = new Iconv('GBK', 'UTF-8//TRANSLIT//IGNORE');
const _ = require('lodash')
const cheerio = require('cheerio')
const numeral = require('numeral')
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug'
const argv = require('yargs').argv
const fs = require('fs')
const path = require('path')
const qs = require('qs')
const { Url } = require("url");
const { Queue } = require('../queue')
const BHOST = 'http://www.bisige.net'
const KEY_WORK_PAGE = 'bisige_work_page'
const session = argv.s
let request;
let UserObj = {
    username: '',
    uid: '',
    coin: 0,
    exp: 0,
    gx: 0,
    jbd: 0,
    score: 0,
}

function buildRequest() {
    let cookiePath = path.resolve(__dirname, '../../datas/bisige_cookie.json')
    let j = _request.jar()
    let ct = fs.readFileSync(cookiePath).toString();
    ct = JSON.parse(ct)
    // let j = tough.CookieJar.fromJSON(ct)
    _.forEach(ct, (v) => {
        v.key = v.name
        let c = tough.Cookie.fromJSON(JSON.stringify(v))
        j.setCookie(c, BHOST)
    })
    // let cookie = tough.Cookie.fromJSON(ct)

    request = _request.defaults({
        jar: j,
        encoding: null,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36'
        },
        'proxy': 'http://localhost:8888',
    })
}

function getMyScore() {
    return new Promise((resolve, reject) => {
        request.get('http://www.bisige.net/home.php?mod=spacecp&ac=credit',
            (error, response, body) => {
                body = iconv.convert(body).toString()
                // logger.info(body)
                let ureg = /discuz_uid = '(\d+)'/g
                let uid = ureg.exec(body)
                if (uid.length !== 2) {
                    reject()
                    return
                }
                UserObj.uid = uid[1]
                const $ = cheerio.load(body)
                UserObj.username = $('#umnav').text().trim()
                $('ul.creditl.mtm.bbda.cl li').each((i, v) => {
                    _.forEach([
                        { name: '金币', key: 'coin' },
                        { name: '经验', key: 'exp' },
                        { name: '贡献', key: 'gx' },
                        { name: '举报点', key: 'jbd' },
                        { name: '积分', key: 'score' },
                    ], (item) => {
                        let em = $(v).find('em')
                        // logger.info(em.text())
                        if (em.text().indexOf(item.name) >= 0) {
                            UserObj[item.key] = parseInt(em[0].next.data)
                        }
                    })
                })
                resolve()
            })
    })
}

function checkLogin() {
    return new Promise((resolve, reject) => {
        getMyScore().then(() => {
            logger.info("用户信息", UserObj)
            resolve()
        }).catch(() => {
            reject()
        })
    })
}

function loadList(url) {
    return new Promise((resolve, reject) => {
        request.get(url, (error, response, body) => {
            if (error != null) {
                reject()
            }
            body = iconv.convert(body).toString()
            const $ = cheerio.load(body)
            let posts = []
            $('#separatorline').nextAll('tbody[id^=normalthread]').each((i, tbody) => {
                tbody = $(tbody)
                let th = tbody.find('th')
                let lastPage = 1
                let lastPageA = th.find('span.tps a')
                if (lastPageA.length > 0) {
                    lastPage = parseInt(lastPageA.eq(-1).text())
                }
                let lastReplyUsername = tbody.find('td.by cite a').eq(-1).text().trim()
                let post = {
                    pid: parseInt(tbody.attr('id').split('_')[1]),
                    category_name: th.find('em a').text().trim(),
                    title: th.find('a.s.xst').text().trim(),
                    page: lastPage,
                    last_is_me: lastReplyUsername == UserObj.username,
                }
                posts.push(post)
                // debugger
            })
            logger.info('fetch posts ', posts.length)
            resolve(posts)
        })
    })
}

function taskPostPick(rawPost) {

}

function getFormAnswer(pid, idhash) {
    let gurl = `http://www.bisige.net/misc.php?mod=secqaa&action=update&idhash=${idhash}&${_.random(0, 1, true)}`
    return new Promise((resolve, reject) => {
        request.get({
            url: gurl, headers: {
                'Referer': `http://www.bisige.net/thread-${pid}-1-2.html`
            }
        }, (error, response, body) => {
            if (error != null) reject()
            body = iconv.convert(body).toString()
            let qreg = /sectplcode\[2\] \+ '(.+) = \?'/g
            let qev = qreg.exec(body)[1]
            let answer = eval(qev)
            // debugger
            resolve(answer)
        })
    })
}

function setPostFile(body$, dbPost) {
    const $ = body$
    let msgs = $('div[id^=post_]')
    let mainMsg = msgs.eq(0)
    let a = mainMsg.find('ignore_js_op a')
    if (a.length > 0) {
        a = a.eq(0)
        let href = a.attr('href').trim()
        if (a.attr('onclick') && a.attr('onclick').indexOf('attachpay') > 0) {
            //付费附件
            dbPost.purchase_url = href
        } else {
            dbPost.download_url = href
        }
    }
}

function getPostDsign(sc) {
    let screg = /<script type="text\/javascript">(.+)<\/script>/g
    sc = screg.exec(sc)[1]
    let window = { _url: '' }
    let location = {
        href: '',
        assign(u) {
            window._url = u
        },
        replace(u) {
            window._url = u
        },
    }
    try {
        eval(sc)
    } catch (e) {
        logger.warn('dsign错误', e)
        return
    }
    let u = _.find([window._url, location, _.get(location, 'href')], v => _.isString(v) && v.indexOf('_dsign') > 0)
    if (u == null) {
        return
    }
    return qs.parse(u.split('?')[1])['_dsign']
}

function replyPost(dbPost, opt = { dsign: null, refer: null, }) {
    // let postUrl = `http://www.bisige.net/thread-${dbPost.pid}-1-2.html`
    let postUrl = `http://www.bisige.net/forum.php?mod=viewthread&tid=${dbPost.pid}`
    if (opt.dsign != null) postUrl += `&_dsign=${opt.dsign}`

    return new Promise((resolve, reject) => {
        logger.info('try reply post', postUrl)
        request.get({
            url: postUrl,
            headers: {
                'Referer': opt.refer,
            }
        }, async (error, response, body) => {
            if (error != null) reject(error)
            body = iconv.convert(body).toString()
            const $ = cheerio.load(body)
            if (body.indexOf('<script') == 0) {
                logger.warn('被防采集检测到，开始获取dsign，建议更换IP')
                //被屏蔽了
                let ds = getPostDsign(body)
                try {
                    let r = await replyPost(dbPost, { dsign: ds })
                    resolve(r)
                } catch (e) {
                    reject(e)
                }
                return
            }

            let msgErr = $('#messagetext.alert_error')
            if (msgErr.length > 0) {
                //没有权限
                logger.warn(`pid=${dbPost.pid}`, msgErr.text())
                dbPost.can_replay = false
                resolve(false)
                return
            }
            if (_.size(dbPost.download_url) == 0) {
                dbPost.download_url = setPostFile($, dbPost)
            }
            let msgs = $('td[id^=postmessage_]')
            let copyMsgNum = _.random(1, msgs.length - 1)
            let copyMsg = msgs.eq(copyMsgNum).text()
            logger.info(`pid=${dbPost.pid}`, '回复内容：', copyMsgNum, copyMsg)
            let replyUrl = `http://www.bisige.net/forum.php?mod=post&action=reply&fid=18&tid=${dbPost.pid}&extra=page%3D2&replysubmit=yes&infloat=yes&handlekey=fastpost&inajax=1`
            let replyForm = $('#f_pst form')
            let pthm = replyForm.find('.pt.hm')
            if (pthm.length >= 1 && pthm.text().indexOf('无权') > 0) {
                //锁定帖，无权限发帖
                logger.warn(`pid=${dbPost.pid}`, pthm.text())
                dbPost.can_replay = false
                resolve(false)
                return
            }

            let postData = {
                message: copyMsg,
                posttime: Math.floor(new Date().getTime() / 1000),
            }

            let formhash = replyForm.find('input[name=formhash]')
            if (formhash.length == 0) {
                debugger
            }
            postData.formhash = formhash.attr('value')
            let secqaa = replyForm.find('span[id^=secqaa_]')
            if (secqaa.length === 0) {
                //没有验证码
            } else {
                //验证问题
                let secqaahash = secqaa.attr('id').split('_')[1]
                postData.secqaahash = secqaahash
                postData.secanswer = await getFormAnswer(dbPost.pid, secqaahash)
            }

            request.post({
                url: replyUrl,
                form: postData,
                headers: {
                    'Referer': `http://www.bisige.net/thread-${dbPost.pid}-1-2.html`
                }
            }, (error2, response2, body2) => {
                if (error2 != null) reject()
                body2 = iconv.convert(body2).toString()
                if (body2.indexOf('回复发布成功') > 0) {
                    let preg = /\d+/g
                    dbPost.my_reply_page = preg.exec($('.pgs.mtm.mbm.cl label span').attr('title'))[0]
                    logger.info(`pid=${dbPost.pid}`, '回复成功')
                    resolve(true)
                } else {
                    logger.warn(`pid=${dbPost.pid}`, body2)
                    reject(body2)
                }
                // debugger
            })
            // resolve(true)
        })
    })
}

function checkPostCanReply(rawPost, dbPost) {
    if (!dbPost.can_replay || //判断权限
        dbPost.my_reply_page > 0 ||//先只回复没有回复过的
        rawPost.page < 2 //只回复满1页的帖子
    ) return false
    // if (rawPost.page <= dbPost.my_reply_page) return false
    return true
}

function getWorkPage() {
    return KV.findByKey(KEY_WORK_PAGE).then(item => {
        if (item == null) {
            return KV.build({ key: KEY_WORK_PAGE, value: 0 })
        } else {
            item.value = parseInt(item.value)
            return item
        }
    })
}

function asyncWaitTime(msec) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve()
        }, msec)
    })
}

const MainCode = {
    SUCCESS: 0,
    ERR_MAX_HOUR_REPLY: 1,
    ERR_COOKIE: 2,
}

async function main() {
    try {
        await checkLogin()
        let workPage = await getWorkPage()
        let needReplyPosts = []
        let replyedPostsNum = 0
        const MAX_REPLEY_NUM = 5
        for (let i = workPage.value + 1; i < 366; i++) {
            logger.info('load page', i)
            let listUrl = `http://www.bisige.net/forum.php?mod=forumdisplay&fid=18&orderby=dateline&page=${i}`
            let posts = await loadList(listUrl)
            for (let j = 0; j < posts.length; j++) {
                let p = posts[j]
                logger.info('检查', `pid=${p.pid}`, p.title)
                let post = await Post.findByPid(p.pid)
                if (post == null) {
                    post = Post.build(_.merge({
                        is_downloaded: false,
                        my_reply_page: 0,
                        can_replay: true,
                    }, p))
                    await post.save()
                }
                if (checkPostCanReply(p, post)) {
                    let isReplied = false
                    try {
                        isReplied = await replyPost(post, { refer: listUrl })
                        await post.save()
                        if (isReplied) {
                            replyedPostsNum += 1
                            //两次回复间隔2分钟
                            let waitTime = _.random(40, 2 * 60)
                            logger.info(`等待${waitTime}秒`)
                            await asyncWaitTime(waitTime * 1000)
                        }
                    } catch (e) {
                        //您所在的用户组每小时限制发回帖 20 个
                        if (_.isString(e) && e.indexOf('每小时') > 0) {
                            return MainCode.ERR_MAX_HOUR_REPLY
                        }
                        post.can_replay = false
                        await post.save()
                    }
                    //最大回复数
                    if (replyedPostsNum >= MAX_REPLEY_NUM) {
                        return MainCode.SUCCESS
                    }
                }
            }
            workPage.value = i
            await workPage.save()
        }
    } catch (e) {
        logger.error('cookie过期')
        return MainCode.ERR_COOKIE
    }
}

async function loopMain() {
    while (true) {
        //7点之前停止回复
        if (new Date().getHours() < 7) {
            logger.info('暂停工作40分钟')
            await asyncWaitTime(40 * 60 * 1000)
        } else {
            let res = await main()
            switch (res) {
                case MainCode.ERR_COOKIE:
                    return
                // case MainCode.SUCCESS:
                // case MainCode.ERR_MAX_HOUR_REPLY:
                default:
                    logger.info('列表暂停5分钟')
                    await asyncWaitTime(5 * 60 * 1000)
                    break;
            }
        }
    }
}

async function checkIn() {
    //签到
}

buildRequest()
//
// main().then(res => {
//
// })
loopMain().then(res => {

})

//test
function _test_loadlist() {
    let listUrl = `http://www.bisige.net/forum.php?mod=forumdisplay&fid=18&orderby=dateline&page=${20}`
    loadList(listUrl).then(posts => {
        debugger
    })
}

// _test_loadlist()

async function _test_replyPost() {
    let post = {
        // pid: 385087,//测试无权限帖子
        // pid: 407, //测试锁定帖
        pid: 532707,//收费附件
    }
    let res = await replyPost(post)
    logger.info(res)
}

// _test_replyPost().then(res => {
//
// })

function _test_getFile() {
    request.get('http://www.bisige.net/thread-532707-1-1.html', async (error, response, body) => {
        if (error != null) return
        let p = {}
        body = iconv.convert(body).toString()
        const $ = cheerio.load(body)
        let furl = setPostFile($, p)
        debugger
    })
}

// _test_getFile()