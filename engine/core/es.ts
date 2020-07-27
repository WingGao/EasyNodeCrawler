import { Client } from '@elastic/elasticsearch';
import { MainConfig } from './config';

let mainClient: Client = null;
export default class ESClient {
  static inst() {
    if (mainClient == null) {
      mainClient = new Client(MainConfig.default().es);
    }
    return mainClient;
  }
}
