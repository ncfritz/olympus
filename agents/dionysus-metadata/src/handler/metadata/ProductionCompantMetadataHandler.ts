import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  PartialProductionCompany,
  PartialProductionCompanyAlternativeName,
  PartialProductionCompanyLogo,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import metadataApi from "../../api/metadataApi";
import { ProductionCompaniesEndpoint } from "../../api/tmdb/productionCompany";
import { MetadataJobMessage } from "../../types/message";

import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class ProductionCompanyMetadataHandler extends BaseMetadataHandler<
  PartialProductionCompany,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.${JobType.PRODUCTION_COMPANIES}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.PRODUCTION_COMPANIES}`,
    queueOptions: {
      channel: "metadataChannel",
    },
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(msg: MetadataJobMessage, amqpMsg: ConsumeMessage) {
    await this.doFetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataFetchJob: MetadataFetchJob,
  ): Promise<[PartialProductionCompany, undefined]> {
    const endpoint = new ProductionCompaniesEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const companyId = parseInt(entityId);
    const companyResponse = await endpoint.details(companyId);
    const alternativeNamesResponse = await endpoint.alternativeNames(companyId);
    const imagesResponse = await endpoint.images(companyId);

    const company = new PartialProductionCompany();
    company.id = companyResponse.id;
    company.name = companyResponse.name;
    company.description = companyResponse.description;
    company.headquarters = companyResponse.headquarters;
    company.homepage = companyResponse.homepage;
    company.logoPath = companyResponse.logo_path;
    company.originCountry = companyResponse.origin_country;

    if (companyResponse.parent_company) {
      company.parentCompanyId = companyResponse.parent_company.id;
    }

    const alternativeNames: PartialProductionCompanyAlternativeName[] = [];

    alternativeNamesResponse.results.forEach((value) => {
      const candidate = {
        productionCompanyId: companyResponse.id,
        name: value.name,
        type: value.type,
      };

      if (
        !alternativeNames.some(
          (e) => e.name === candidate.name && e.type === value.type,
        )
      ) {
        alternativeNames.push(candidate);
      }
    });

    const logos: PartialProductionCompanyLogo[] = [];

    imagesResponse.logos.forEach((value) => {
      logos.push({
        productionCompanyId: companyResponse.id,
        id: value.id,
        fileType: value.file_type,
        filePath: value.file_path,
        width: value.width,
        height: value.height,
      });
    });

    company.alternativeNames = alternativeNames;
    company.logos = logos;

    await metadataApi.createProductionCompany(company);

    return [company, undefined];
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getTtl(metadata: PartialProductionCompany): number {
    return Math.max(7, Math.floor(Math.random() * 180));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getJitter(metadata: PartialProductionCompany): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
