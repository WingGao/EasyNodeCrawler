/**
 * 爬取的文章数据
 */
import ESClient from './es';
import { MainConfig } from './config';

export class Post {
  site: string; //站点的host
  id: string;
  url: string;
  title: string; //标题
  authorId: string; //用户id
  body: string; //正文内容
  createTime: Date; //创建日期
  updateTime: Date; //最后更新日期
  parentPostId: string;
  categoryId: string;
  viewNum: number; //查看次数

  uniqId() {
    return `${this.site}-${this.id}`;
  }

  indexName() {
    return `${MainConfig.default().dataPrefix}post`;
  }

  async save() {
    let res = await ESClient.inst().create({
      index: this.indexName(),
      id: this.uniqId(),
      body: this,
    });
    debugger;
  }

  async _createIndex() {
    let res = await ESClient.inst().index({
      index: this.indexName(),
      body: {
        mappings: {
          properties: {
            site: { type: 'keyword' },
            id: { type: 'keyword' },
            authorId: { type: 'keyword' },
            categoryId: { type: 'keyword' },
            parentPostId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            body: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            createTime: { type: 'date' },
            updateTime: { type: 'date' },
            viewNum: { type: 'integer' },
          },
        },
      },
    });
  }
}
