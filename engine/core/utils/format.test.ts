import urlencode = require('urlencode');

describe('format', () => {
  test('toGBKUrlEncode', () => {
    let r = urlencode('好', 'gbk');
    expect(r).toEqual('%BA%C3');
  });
});
