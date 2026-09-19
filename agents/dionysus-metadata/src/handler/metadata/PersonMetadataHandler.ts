import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  Gender,
  MetadataFetchJob,
  PartialBaseImage,
  PartialExternalId,
  PartialPerson,
  PartialPersonAlsoKnownAs,
} from "@ncfritz/olympus-sdk/dionysus";
import { Injectable } from "@nestjs/common";
import { type ConsumeMessage } from "amqplib";
import moment from "moment";
import metadataApi from "../../api/metadataApi";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
  PEOPLE_ID_TYPES,
  TRIGGER_SUFFIX,
} from "../../util/constants";
import { UniqueSet } from "../../util/UniqueSet";
import { BaseMetadataHandler } from "./BaseMetadataHandler";

@Injectable()
export class PersonMetadataHandler extends BaseMetadataHandler<
  PartialPerson,
  undefined
> {
  @RabbitSubscribe({
    exchange: `${METADATA_JOB_PREFIX}.${TRIGGER_SUFFIX}`,
    queue: `${METADATA_JOB_PREFIX}.people.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.people`,
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
  ): Promise<[PartialPerson, undefined]> {
    const personId = parseInt(entityId);

    const personResponse = await this.tmdbApi.getPersonDetails(personId, [
      "images",
      "external_ids",
    ]);

    const alsoKnownAs: UniqueSet<PartialPersonAlsoKnownAs> = new UniqueSet();

    personResponse.also_known_as.forEach((value) => {
      alsoKnownAs.add({
        name: value,
      });
    });

    const images: UniqueSet<PartialBaseImage> = new UniqueSet();

    if (personResponse.images?.profiles) {
      personResponse.images.profiles.forEach((value) => {
        images.add({
          filePath: value.file_path,
          width: value.width,
          height: value.height,
          languageCode: value.iso_639_1,
        });
      });
    }

    const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

    if (personResponse.external_ids) {
      Object.entries(PEOPLE_ID_TYPES).forEach(([idType, idName]) => {
        if (personResponse.external_ids[idType as never]) {
          externalIds.add({
            type: idName,
            externalId: `${personResponse.external_ids[idType as never]}`,
          });
        }
      });
    }

    const person: PartialPerson = {
      id: personResponse.id,
      name: personResponse.name,
      adult: personResponse.adult,
      biography: personResponse.biography,
      birthday: personResponse.birthday
        ? moment(personResponse.birthday).toISOString()
        : undefined,
      birthplace: personResponse.place_of_birth,
      deathday: personResponse.deathday
        ? moment(personResponse.deathday).toISOString()
        : undefined,
      gender: personResponse.gender as Gender,
      homepage: personResponse.homepage,
      imdbId: personResponse.imdb_id,
      knownForDepartment: personResponse.known_for_department,
      profilePath: personResponse.profile_path,
      popularity: personResponse.popularity,
      alsoKnownAs: [...alsoKnownAs],
      images: [...images],
      externalIds: [...externalIds],
    };

    await metadataApi.createPerson(person);

    return [person, undefined];
  }

  protected getTtl(metadata: PartialPerson): number {
    if (metadata.deathday) {
      return Math.max(60, Math.floor(Math.random() * 180));
    }

    return Math.max(7, Math.floor(Math.random() * 14));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getJitter(metadata: PartialPerson): number {
    return Math.floor(Math.random() * 14 * 24 * 60);
  }

  protected cleanup(): Promise<void> {
    return Promise.resolve();
  }
}
