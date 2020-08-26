import cheerio = require('cheerio');

abstract class CheckinHandler {
  fetchCheckin: () => Promise<string>;
  constructor(fetchCheckin: () => Promise<string>) {
    this.fetchCheckin = fetchCheckin;
  }

  async checkin(): Promise<boolean> {
    let html = await this.fetchCheckin();
    let $ = cheerio.load(html);
    if (this.isChecked($)) {
      return false;
    }
    return await this.doCheck($);
  }
  abstract isChecked($: CheerioStatic): boolean;
  abstract async doCheck($: CheerioStatic): Promise<boolean>;
}
export default CheckinHandler;
