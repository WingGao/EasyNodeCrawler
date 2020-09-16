import { sleep } from './time';
import execa = require('execa');
import * as iconv from 'iconv-lite';
let ignoreErrors = [
  'socket hang up',
  'Client network socket disconnected before secure TLS connection was established',
];
// onError: false继续，true退出
export async function runSafe(act: (retry: number) => Promise<any>, onError: (Error) => Promise<boolean>) {
  let retry = 0;
  while (true) {
    let ok = true;
    try {
      await act(retry);
    } catch (e) {
      if (ignoreErrors.find((v) => e.message.indexOf(v) >= 0) != null) {
        ok = false;
      } else {
        ok = await onError(e);
      }
    }
    if (ok) break;
    else await sleep(10 * 1000);
    retry++;
  }
}

export const execaCn = {
  commandSync: (command: string, options: execa.SyncOptions = {}): execa.ExecaSyncReturnValue => {
    // @ts-ignore
    options.encoding = 'binary';
    // @ts-ignore
    options.stdout = process.stdout;
    // @ts-ignore
    options.stderr = process.stderr;
    try {
      let res = execa.commandSync(command, options);
      if (res.stdout) res.stdout = iconv.decode(Buffer.from(res.stdout, 'binary'), 'gbk');
      if (res.stderr) res.stderr = iconv.decode(Buffer.from(res.stderr, 'binary'), 'gbk');
      return res;
    } catch (e) {
      debugger;
    }
  },
};
