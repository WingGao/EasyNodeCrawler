import axios from 'axios';
import { MainConfig } from '../config';

let wgwClient = axios.create({
  baseURL: MainConfig.default().wgwHost,
  headers: {
    'X-ME': 'chESTArtEnDs',
  },
});

export default wgwClient;
