export async function runSafe(act: () => Promise<any>) {
  while (true) {
    let ok = true;
    await act().catch((e: Error) => {
      if (e.message.indexOf('socket hang up') >= 0) {
        ok = false;
      }
    });
    if (ok) break;
  }
}
