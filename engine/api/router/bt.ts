import * as Router from 'koa-router';
import BtMainInst from '../../core/site/bt/main';
import { MainConfig } from '../../core/config';
import 'koa-body/index';
import fs = require('fs');

export async function registerBt(router: Router, prefix = '/api/bt') {
  MainConfig.logger().info('注册', prefix);
  await BtMainInst.init();
  //查找相似
  router.post(`${prefix}/findSimilarTorrent`, async (ctx, next) => {
    const file = ctx.request.files.file;
    const q = JSON.parse(ctx.request.body.q);
    let r = await BtMainInst.findSimilarTorrent({ btPath: file.path, ...q });
    ctx.body = r;
    return next();
  });
  // 获取种子文件
  router.get(`${prefix}/torrentFile`, async (ctx, next) => {
    let site = BtMainInst.sites[ctx.request.query.site];
    let fName = await site.downloadBtFile(ctx.request.query.tid);
    if (fName == null) {
      ctx.status = 404;
    } else {
      ctx.body = fs.createReadStream(fName as string);
    }
    return next();
  });
}
