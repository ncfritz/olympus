import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  PartialCollection,
  PartialCollectionImage,
  PartialCollectionPart,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import { CollectionsEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class CollectionsMetadataHandler extends BaseMetadataHandler<
  PartialCollection,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.${JobType.COLLECTIONS}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.COLLECTIONS}`,
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
  ): Promise<[PartialCollection, undefined]> {
    const endpoint = new CollectionsEndpoint(
      this.configService.get<string>("TMDB_API_KEY")!,
    );

    const collectionId = parseInt(entityId);
    const collectionResponse = await endpoint.details(collectionId);
    const collectionImagesResponse = await endpoint.images(collectionId);

    const collection = new PartialCollection();
    collection.id = collectionResponse.id;
    collection.name = collectionResponse.name;
    collection.overview = collectionResponse.overview;
    collection.posterPath = collectionResponse.poster_path;
    collection.backdropPath = collectionResponse.backdrop_path;

    const parts: PartialCollectionPart[] = [];

    collectionResponse.parts.forEach((value) => {
      if (!parts.some((e) => e.movieId === value.id)) {
        parts.push({
          movieId: value.id,
        });
      }
    });

    const images: PartialCollectionImage[] = [];

    collectionImagesResponse.posters.forEach((value) => {
      const candidate = {
        type: "poster",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      };

      if (
        !images.some(
          (e) =>
            e.type === "poster" &&
            e.countryCode === candidate.countryCode &&
            e.filePath === value.file_path,
        )
      ) {
        images.push(candidate);
      }
    });

    collectionImagesResponse.backdrops.forEach((value) => {
      const candidate = {
        type: "backdrop",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        countryCode: value.iso_639_1 || "en",
      };

      if (
        !images.some(
          (e) =>
            e.type === "backdrop" &&
            e.countryCode === candidate.countryCode &&
            e.filePath === value.file_path,
        )
      ) {
        images.push(candidate);
      }
    });

    collection.parts = parts;
    collection.images = images;

    await metadataApi.createCollection(collection);

    return [collection, undefined];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getTtl(metadata: PartialCollection): number {
    return Math.max(7, Math.floor(Math.random() * 180));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getJitter(metadata: PartialCollection): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
