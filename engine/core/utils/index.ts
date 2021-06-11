export * from './format';
export * from './time';
export * from './selenium';
export * from './task';

import log4js = require('log4js');

export function getLogger(cate?: string) {
    const logger = log4js.getLogger('GoogleResultParserCAS');
    logger.level = 'debug';
    return logger
}
