import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialNetwork,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toTvNetwork } from "../mappers/tvNetwork";
import { EntityHandler } from "./EntityHandler";

/** A TV network, with alternative names and logos. */
@Injectable()
export class TvNetworkMetadataHandler extends EntityHandler<
  PartialNetwork,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.tv_networks)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    _metadataFetchJob: MetadataFetchJob,
    _metadataManager: FetchJobStore,
  ): Promise<[PartialNetwork, undefined]> {
    const networkId = parseInt(entityId);
    const networkResponse = await this.tmdbClient.getNetworkDetails(networkId);
    const alternativeNamesResponse =
      await this.tmdbClient.getNetworkAlternativeNames(networkId);
    const imagesResponse = await this.tmdbClient.getNetworkImages(networkId);

    const network = toTvNetwork(
      networkResponse,
      alternativeNamesResponse,
      imagesResponse,
    );

    await this.metadataApi.createNetwork(network);

    return [network, undefined];
  }

  protected getTtl(_metadata: PartialNetwork): number {
    return Math.max(7, Math.floor(Math.random() * 180));
  }

  protected getJitter(_metadata: PartialNetwork): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
