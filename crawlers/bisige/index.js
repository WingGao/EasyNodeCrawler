const { Post } = require('./models')
const _request = require('request')
const tough = require('tough-cookie');
const Iconv = require('iconv').Iconv;
const iconv = new Iconv('GBK', 'UTF-8//TRANSLIT//IGNORE');
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
const BHOST = 'http://www.bisige.net'
const session = argv.s
let request;
let UserObj = {
    uid: '',
    coin: 0,
    exp: 0,
    gx: 0,
    jbd: 0,
    score:0,
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
                $('ul.creditl.mtm.bbda.cl li').each((i, v) => {
                    _.forEach([
                        { name: '金币', key: 'coin' },
                        { name: '经验', key: 'exp' },
                        { name: '贡献', key: 'gx' },
                        { name: '举报点', key: 'jbd' },
                        { name: '积分', key: 'score' },
                    ], (item) => {
                        let em = $(v).find('em')
                        logger.info(em.text())
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
    getMyScore()
    logger.info(session)
}

function main() {
    buildRequest()

    if (!checkLogin()) {
        console.log('session error')
        return
    }
}

main()