
# EasyNodeCrawler

写了很多的爬虫，最终还是选择基于JS来做爬取解析引擎。
将数据爬取，并直接保存到ES，由ES提供分词搜索功能

## 结构

* engine  爬取引擎
* -- core 通用爬取功能
* chrome-task 一些Chrome操作的任务

## 环境安装

#### ES配置
```
# version 7.8.0
# 下载es https://www.elastic.co/cn/downloads/elasticsearch
# 下载分词 https://github.com/medcl/elasticsearch-analysis-ik
```

### 问题
*     "opencc": "^1.1.1",
