import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import type {
  MetadataFetchJob,
  PartialPerson,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import type { FetchJobStore } from "../../fetchJobs/FetchJobStore";
import { ENTITY_SUBSCRIPTIONS, type MetadataJobMessage } from "../../messaging";
import { toPerson } from "../mappers/person";
import { EntityHandler } from "./EntityHandler";

/** A person, with images and external IDs. */
@Injectable()
export class PersonMetadataHandler extends EntityHandler<
  PartialPerson,
  undefined
> {
  @RabbitSubscribe(ENTITY_SUBSCRIPTIONS.people)
  public async handle(msg: MetadataJobMessage): Promise<void> {
    await this.fetch(msg);
  }

  async doFetchMetadata(
    entityId: string,
    _metadataFetchJob: MetadataFetchJob,
    _metadataManager: FetchJobStore,
  ): Promise<[PartialPerson, undefined]> {
    const personId = parseInt(entityId);

    const personResponse = await this.tmdbClient.getPersonDetails(personId, [
      "images",
      "external_ids",
    ]);

    const person = toPerson(personResponse);

    await this.metadataApi.createPerson(person);

    return [person, undefined];
  }

  protected getTtl(metadata: PartialPerson): number {
    if (metadata.deathday) {
      return Math.max(60, Math.floor(Math.random() * 180));
    }

    return Math.max(7, Math.floor(Math.random() * 14));
  }

  protected getJitter(_metadata: PartialPerson): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }
}
