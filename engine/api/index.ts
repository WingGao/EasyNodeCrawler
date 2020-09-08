import Koa = require('koa');
const koaBody = require('koa-body');
import { initConfig } from '../core';
import { MainConfig } from '../core/config';
import router, { registerBt } from './router';
const app = new Koa();

app
  .use(koaBody({ multipart: true }))
  .use(router.routes())
  .use(router.allowedMethods());

async function main() {
  await initConfig();
  let port = MainConfig.default().http.port;
  await registerBt(router);
  MainConfig.logger().info(`监听 http://localhost:${port}`);
  app.listen(port);
}

if (require.main === module) {
  main();
}
