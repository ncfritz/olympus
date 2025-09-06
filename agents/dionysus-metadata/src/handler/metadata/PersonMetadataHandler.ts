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
import { PersonEndpoint } from "../../api/tmdb/person";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { type MetadataJobMessage } from "../../types/message";
import {
  JOB_TYPE_PREFIX,
  METADATA_JOB_PREFIX,
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
    const endpoint = new PersonEndpoint(
      this.configService.get<string>("TMDB_API_KEY", ""),
    );

    const personId = parseInt(entityId);

    const personResponse = await endpoint.details(personId, [
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

    personResponse.images.profiles.forEach((value) => {
      images.add({
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1,
      });
    });

    const externalIds: UniqueSet<PartialExternalId> = new UniqueSet();

    if (personResponse.external_ids) {
      if (personResponse.external_ids.freebase_mid) {
        externalIds.add({
          type: "freebaseMID",
          externalId: `${personResponse.external_ids.freebase_mid}`,
        });
      }

      if (personResponse.external_ids.freebase_id) {
        externalIds.add({
          type: "freebaseId",
          externalId: `${personResponse.external_ids.freebase_id}`,
        });
      }

      if (personResponse.external_ids.imdb_id) {
        externalIds.add({
          type: "imdb",
          externalId: `${personResponse.external_ids.imdb_id}`,
        });
      }

      if (personResponse.external_ids.tvrage_id) {
        externalIds.add({
          type: "tvRange",
          externalId: `${personResponse.external_ids.tvrage_id}`,
        });
      }

      if (personResponse.external_ids.wikidata_id) {
        externalIds.add({
          type: "wikidata",
          externalId: `${personResponse.external_ids.wikidata_id}`,
        });
      }

      if (personResponse.external_ids.facebook_id) {
        externalIds.add({
          type: "facebook",
          externalId: `${personResponse.external_ids.facebook_id}`,
        });
      }

      if (personResponse.external_ids.instagram_id) {
        externalIds.add({
          type: "instagram",
          externalId: `${personResponse.external_ids.instagram_id}`,
        });
      }

      if (personResponse.external_ids.tiktok_id) {
        externalIds.add({
          type: "tiktok",
          externalId: `${personResponse.external_ids.tiktok_id}`,
        });
      }

      if (personResponse.external_ids.twitter_id) {
        externalIds.add({
          type: "twitter",
          externalId: `${personResponse.external_ids.twitter_id}`,
        });
      }

      if (personResponse.external_ids.youtube_id) {
        externalIds.add({
          type: "youtube",
          externalId: `${personResponse.external_ids.youtube_id}`,
        });
      }
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
