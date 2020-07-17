/**
 * 配置项
 */
class Index {}

/**
 * 爬取站点的配置
 */
export class SiteConfig {
  name: String;
  host: String;
  https: boolean = false;
}
