import { BaseEndpoint } from "tmdb-ts/dist/endpoints/base";
import {
  AlternativeNames,
  Images,
  ProductionCompany,
} from "../../types/tmdb/productionCompany";

const BASE_PRODUCTION_COMPANIES = "/company";

export class ProductionCompaniesEndpoint extends BaseEndpoint {
  constructor(protected readonly accessToken: string) {
    super(accessToken);
  }

  async details(companyId: number): Promise<ProductionCompany> {
    return await this.api.get<ProductionCompany>(
      `${BASE_PRODUCTION_COMPANIES}/${companyId}`,
    );
  }

  async images(companyId: number): Promise<Images> {
    return await this.api.get<Images>(
      `${BASE_PRODUCTION_COMPANIES}/${companyId}/images`,
    );
  }

  async alternativeNames(companyId: number): Promise<AlternativeNames> {
    return await this.api.get<AlternativeNames>(
      `${BASE_PRODUCTION_COMPANIES}/${companyId}/alternative_names`,
    );
  }
}
