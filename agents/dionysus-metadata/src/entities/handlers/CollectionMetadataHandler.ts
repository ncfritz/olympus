import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialCollection,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toCollection } from "../mappers/collection";
import { EntityHandler } from "./EntityHandler";

/** A collection (e.g. a film series) and its parts and images. */
@Injectable()
export class CollectionMetadataHandler extends EntityHandler<
  PartialCollection,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.collections)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    _metadataFetchJob: MetadataFetchJob,
    _metadataManager: FetchJobStore,
  ): Promise<[PartialCollection, undefined]> {
    const collectionId = parseInt(entityId);
    const collectionResponse =
      await this.tmdbClient.getCollectionDetails(collectionId);
    const collectionImagesResponse =
      await this.tmdbClient.getCollectionImages(collectionId);

    const collection = toCollection(
      collectionResponse,
      collectionImagesResponse,
    );

    await this.metadataApi.createCollection(collection);

    return [collection, undefined];
  }

  protected getTtl(_metadata: PartialCollection): number {
    return Math.max(7, Math.floor(Math.random() * 180));
  }

  protected getJitter(_metadata: PartialCollection): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
