import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  PartialAlternativeName,
  PartialIdentifiableImage,
  PartialProductionCompany,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import metadataApi from "../../api/metadataApi";
import { ProductionCompaniesEndpoint } from "../../api/tmdb/productionCompany";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";

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
    queue: `${METADATA_JOB_PREFIX}.production_companies.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.production_companies`,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadataManager: MetadataFetchJobManager,
  ): Promise<[PartialProductionCompany, undefined]> {
    const endpoint = new ProductionCompaniesEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const companyId = parseInt(entityId);
    const companyResponse = await endpoint.details(companyId);
    const alternativeNamesResponse = await endpoint.alternativeNames(companyId);
    const imagesResponse = await endpoint.images(companyId);

    const alternativeNames: PartialAlternativeName[] = [];

    alternativeNamesResponse.results.forEach((value) => {
      const candidate = {
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

    const logos: PartialIdentifiableImage[] = [];

    imagesResponse.logos.forEach((value) => {
      logos.push({
        //productionCompanyId: companyResponse.id,
        id: value.id,
        fileType: value.file_type,
        filePath: value.file_path,
        width: value.width,
        height: value.height,
      });
    });

    let parentCompanyId: number | undefined = undefined;

    if (companyResponse.parent_company) {
      parentCompanyId = companyResponse.parent_company.id;
    }

    const company: PartialProductionCompany = {
      id: companyResponse.id,
      name: companyResponse.name,
      description: companyResponse.description,
      headquarters: companyResponse.headquarters,
      homepage: companyResponse.homepage,
      logoPath: companyResponse.logo_path,
      originCountry: companyResponse.origin_country,
      parentCompanyId: parentCompanyId,
      alternativeNames: alternativeNames,
      logos: logos,
    };

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
