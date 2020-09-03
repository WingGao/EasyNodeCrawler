import genericPool = require('generic-pool');
import _ = require('lodash');
import { sleep } from '../../core/utils';
beforeAll(async () => {
  jest.setTimeout(3 * 60 * 1000);
});
test('pool', async () => {
  let pool = genericPool.createPool(
    {
      create: () => {
        let r = { v: _.uniqueId() };
        console.log('create', r);
        return Promise.resolve(r);
      },
      destroy: (t) => Promise.resolve(console.log('destroy', t)),
    },
    {
      max: 2,
      min: 2,
      // testOnBorrow: true,
    },
  );
  for (let i = 0; i < 20; i++) {
    pool.acquire().then((r) => {
      console.log('do', i, r.v);
      sleep(1000).then(() => {
        pool.destroy(r);
      });
    });
  }
  await pool.drain();
  await pool.clear();
});
