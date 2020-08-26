import _ = require('lodash');

export function randomChoice<T>(items: Array<T>): T {
  if (items == null || items.length == 0) return null;
  return items[_.random(0, items.length, false)];
}
