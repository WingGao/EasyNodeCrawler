import * as moment from 'moment';

export function sleep(ms, logg?) {
  if (logg != null) {
    logg(['sleep', moment.duration(ms).toISOString()]);
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}
