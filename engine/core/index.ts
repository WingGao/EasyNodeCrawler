import * as yargs from 'yargs';
import { MainConfig, SiteCacheInfo, SiteConfig, SiteType } from './config';
import path = require('path');
import fs = require('fs');
import ESClient from './es';
import { Post } from './post';
import Sites from '../sites';
import * as _ from 'lodash';
import { SiteCrawler, SiteCrawlerDiscuz } from './site';
import { SpamRecord } from '../spam/model';
import KVItem from './model/kv';

async function main() {
  let argv = yargs
    .options({
      config: {
        alias: 'c',
        type: 'string',
        description: '配置文件',
      },
      site: {
        type: 'string',
        description: '爬取的站点host',
      },
    })
    .help('h')
    .alias('h', 'help').argv;
  await initConfig(argv.config);
  let sites = Sites();
  let sc = _.find(sites, (v) => v.host == argv.site);
  let currentSite: SiteCrawler;
  switch (sc.siteType) {
    case SiteType.Discuz:
      currentSite = new SiteCrawlerDiscuz(sc);
      break;
  }
  currentSite.start();
}

export async function initConfig(configPath) {
  let config = MainConfig.loadYAML(path.resolve(configPath));
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
  for (let r of [new SpamRecord(), new KVItem()]) {
    await r.ensureIndex();
  }
  return config;
}

if (require.main === module) {
  main();
}
