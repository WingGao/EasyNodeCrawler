export async function runSafe(act: () => Promise<any>, onError: (Error) => boolean) {
  while (true) {
    let ok = true;
    await act().catch((e: Error) => {
      if (e.message.indexOf('socket hang up') >= 0) {
        ok = false;
      } else {
        ok = onError(e);
      }
    });
    if (ok) break;
  }
}
