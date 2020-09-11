import ResourceTask from './resourceTask';
jest.setTimeout(600 * 1000);
test('resourceTask', async () => {
  let r = new ResourceTask({
    resourceArr: [1],
    max: 3,
    onDo: async (v) => {
      console.log(v);
    },
  });
  r.start();
  await r.wait();
  console.log('done');
});
