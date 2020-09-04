import axios from 'axios';
import { MainConfig } from '../../config';

let wgwClient;
class WgwClient {
  axios = axios.create({
    baseURL: MainConfig.default().wgwHost,
    headers: {
      'X-ME': 'chESTArtEnDs',
    },
  });

  static inst() {
    if (wgwClient == null) {
      wgwClient = new WgwClient();
    }
    return wgwClient;
  }
  static checkRep(rep) {}
  /**
   * 发送通知给自己
   * @param title
   * @param body
   */
  async sendMail(title, body) {
    let rep = await this.axios.post('/api/wgw/notify/mail', {
      ToUserName: '459171748@qq.com',
      Title: title,
      Context: body,
    });
    WgwClient.checkRep(rep);
  }
}

export default WgwClient;
