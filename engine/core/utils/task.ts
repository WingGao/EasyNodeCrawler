import { sleep } from './time';

let ignoreErrors = [
  'socket hang up',
  'Client network socket disconnected before secure TLS connection was established',
];
export async function runSafe(act: () => Promise<any>, onError: (Error) => Promise<boolean>) {
  while (true) {
    let ok = true;
    try {
      await act();
    } catch (e) {
      if (ignoreErrors.find((v) => e.message.indexOf(v) >= 0) != null) {
        ok = false;
      } else {
        ok = await onError(e);
      }
    }
    if (ok) break;
    else await sleep(10 * 1000);
  }
}
