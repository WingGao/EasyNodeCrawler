import MTeamConfig from './pt_mteam_cc';
import NicePt from './nicept';
import PTHome from './pt_home';
import LeagueHD from './leaguehd';
import PterClub from './pterclub';
import SoulVoice from './soulvoice';
import BtSchool from './btschool';
import Haidan from './haidan';
import OshenPT from './oshen';
import TjuPt from './tjupt';
import _ = require('lodash');

let siteList = [MTeamConfig, NicePt, PTHome, LeagueHD, PterClub, SoulVoice, BtSchool, Haidan, OshenPT, TjuPt];
//将alias和key都做成字典
let siteFullMaps = _.reduce(
  siteList,
  (r, v) => {
    v.alias.concat(v.key).forEach((sk) => {
      if (r[sk] != null) throw new Error(`siteKey=${sk}已存在`);
      r[sk] = v;
    });
    return r;
  },
  {},
);
function getSiteConfigs() {
  return [MTeamConfig, NicePt, PTHome, LeagueHD, PterClub, SoulVoice, BtSchool, Haidan, OshenPT, TjuPt];
}
export default getSiteConfigs;
export { siteFullMaps };
