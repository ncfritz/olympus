import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  MetadataFetchJob,
  PartialCollection,
  PartialCollectionPart,
  PartialTypedImage,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import { CollectionsEndpoint } from "tmdb-ts/dist/endpoints";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";
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
    queue: `${METADATA_JOB_PREFIX}.collections.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.collections`,
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

    const parts: PartialCollectionPart[] = [];

    collectionResponse.parts.forEach((value) => {
      if (!parts.some((e) => e.movieId === value.id)) {
        parts.push({
          movieId: value.id,
        });
      }
    });

    const images: PartialTypedImage[] = [];

    collectionImagesResponse.posters.forEach((value) => {
      const candidate = {
        type: "poster",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1 || "en",
      };

      if (
        !images.some(
          (e) =>
            e.type === "poster" &&
            e.languageCode === candidate.languageCode &&
            e.filePath === value.file_path,
        )
      ) {
        images.push(candidate);
      }
    });

    const collection: PartialCollection = {
      id: collectionResponse.id,
      name: collectionResponse.name,
      overview: collectionResponse.overview,
      posterPath: collectionResponse.poster_path,
      backdropPath: collectionResponse.backdrop_path,
      parts: parts,
      images: images,
    };

    collectionImagesResponse.backdrops.forEach((value) => {
      const candidate = {
        type: "backdrop",
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1 || "en",
      };

      if (
        !images.some(
          (e) =>
            e.type === "backdrop" &&
            e.languageCode === candidate.languageCode &&
            e.filePath === value.file_path,
        )
      ) {
        images.push(candidate);
      }
    });

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
