import * as yargs from 'yargs';
import { MainConfig } from './config';
import path = require('path');
import fs = require('fs');
import ESClient from './es';
import { Post } from './post';

async function main() {
  let argv = yargs
    .options({
      config: {
        alias: 'c',
        type: 'string',
        description: '配置文件',
      },
    })
    .help('h')
    .alias('h', 'help').argv;
  let config = MainConfig.loadYAML(path.resolve(argv.config));
  MainConfig.default(config);
  // 准备数据
  let esClient = ESClient.inst();
  let post = new Post();
  if (
    (await esClient.indices.get({ index: post.indexName() }).catch((e) => {
      if (e.message == 'index_not_found_exception') {
        return false;
      }
    })) === false
  ) {
    MainConfig.logger().info('创建索引', post.indexName());
    let rep = await post._createIndex();
  }
}

main();
