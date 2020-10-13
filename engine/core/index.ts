import * as yargs from 'yargs';
import { MainConfig, SiteConfig, SiteType } from './config';
import path = require('path');
import fs = require('fs');
import ESClient from './es';
import { Post } from './post';
import Sites from '../sites';
import * as _ from 'lodash';
import { SiteCrawler, SiteCrawlerDiscuz } from './site';
import { SpamRecord } from '../spam/model';
import KVItem from './model/kv';
import { BtSubItem, BtTorrent } from './site/bt/model';
import Redis from './redis';

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

export async function initConfig(configPath?) {
  if (configPath == null) configPath = path.resolve(__dirname, '../../config/dev.yaml');
  else configPath = path.resolve(configPath);
  MainConfig.logger().info('加载配置', configPath);
  let config = MainConfig.loadYAML(configPath);
  MainConfig.default(config);
  // 准备数据
  let esClient = ESClient.inst();
  let post = new Post();
  if (
    (await esClient.indices.get({ index: post.indexName() }).catch((e) => {
      if (e.message == 'index_not_found_exception') {
        return false;
      } else {
        throw e;
      }
    })) === false
  ) {
    MainConfig.logger().info('创建索引', post.indexName());
    let rep = await post._createIndex();
  }
  for (let r of [new SpamRecord(), new KVItem(), new BtTorrent(), new BtSubItem()]) {
    await r.ensureIndex();
  }
  //redis
  await Redis.inst().ping();
  return config;
}

if (require.main === module) {
  main();
}
