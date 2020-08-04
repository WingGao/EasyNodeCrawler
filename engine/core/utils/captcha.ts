// 验证码服务
import axios = require('axios');
import wgwClient from './wgw';
import { sleep } from './time';
import _ = require('lodash');
import { MainConfig } from '../config';

export async function waitForCaptcha(img64: String, desc: String) {
  // 创建服务
  let createRep = await wgwClient.post('/api/wgw/captcha/dec/create', {
    ImageB64: img64,
    Description: desc,
  });
  let key = createRep.data.Key;
  let sleepTime = 30;
  let maxLoop = (30 * 60) / sleepTime;
  for (let i = 0; i < maxLoop; i++) {
    await sleep(sleepTime * 1000);
    let checkRep = await wgwClient.get(`/api/wgw/captcha/dec/get?Key=${key}`);
    MainConfig.logger().debug('waitForCaptcha', '等待', createRep.data);
    if (_.size(checkRep.data.Code) > 0) {
      return checkRep.data.Code;
    }
  }
}
