import fs = require('fs');
import path = require('path');

let cs = fs.readFileSync(path.resolve(__dirname, '../../config/cookie-loc.json'));
let cookies = JSON.parse(cs.toString());
export default cookies;
