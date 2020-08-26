import { randomCnIP } from './net';

describe('net.ts', () => {
  test('random_cn_ip', () => {
    let ip = randomCnIP();
    expect(ip).not.toBeNull();
  });
});
