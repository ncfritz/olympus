import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialProductionCompany,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toProductionCompany } from "../mappers/productionCompany";
import { EntityHandler } from "./EntityHandler";

/** A production company, with alternative names and logos. */
@Injectable()
export class ProductionCompanyMetadataHandler extends EntityHandler<
  PartialProductionCompany,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.production_companies)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    _metadataFetchJob: MetadataFetchJob,
    _metadataManager: FetchJobStore,
  ): Promise<[PartialProductionCompany, undefined]> {
    const companyId = parseInt(entityId);
    const companyResponse =
      await this.tmdbClient.getProductionCompanyDetails(companyId);
    const alternativeNamesResponse =
      await this.tmdbClient.getProductionCompanyAlternativeNames(companyId);
    const imagesResponse =
      await this.tmdbClient.getProductionCompanyImages(companyId);

    const company = toProductionCompany(
      companyResponse,
      alternativeNamesResponse,
      imagesResponse,
    );

    await this.metadataApi.createProductionCompany(company);

    return [company, undefined];
  }

  protected getTtl(_metadata: PartialProductionCompany): number {
    return Math.max(7, Math.floor(Math.random() * 180));
  }

  protected getJitter(_metadata: PartialProductionCompany): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
