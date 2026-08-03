import { BaseEndpoint } from "tmdb-ts/dist/endpoints/base";
import { Country } from "../../types/tmdb/country";
import { Language } from "../../types/tmdb/language";

export class ConfigurationEndpoint extends BaseEndpoint {
  constructor(protected readonly accessToken: string) {
    super(accessToken);
  }

  async countries(): Promise<Country[]> {
    return await this.api.get<Country[]>("/configuration/countries");
  }

  async languages(): Promise<Language[]> {
    return await this.api.get<Language[]>("/configuration/languages");
  }
}
