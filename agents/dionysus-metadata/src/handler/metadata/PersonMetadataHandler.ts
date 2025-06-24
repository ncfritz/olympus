import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import {
  JobType,
  MetadataFetchJob,
  PartialPerson,
  PartialPersonAlsoKnownAs,
  PartialPersonExternalId,
  PartialPersonImage,
} from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { ConsumeMessage } from "amqplib";
import moment from "moment";
import metadataApi from "../../api/metadataApi";
import { PersonEndpoint } from "../../api/tmdb/person";
import { MetadataFetchJobManager } from "../../cache/MetadataFetchJobManager";
import { MetadataJobMessage } from "../../types/message";
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
    queue: `${METADATA_JOB_PREFIX}.${JobType.PEOPLE}.${TRIGGER_SUFFIX}`,
    routingKey: `${JOB_TYPE_PREFIX}.${JobType.PEOPLE}`,
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

    const person = new PartialPerson();
    person.id = personResponse.id;
    person.name = personResponse.name;
    person.adult = personResponse.adult;
    person.biography = personResponse.biography;
    person.birthday = personResponse.birthday
      ? moment(personResponse.birthday)
      : undefined;
    person.birthplace = personResponse.place_of_birth;
    person.deathday = personResponse.deathday
      ? moment(personResponse.deathday)
      : undefined;
    person.gender = personResponse.gender;
    person.homepage = personResponse.homepage;
    person.imdbId = personResponse.imdb_id;
    person.knownForDepartment = personResponse.known_for_department;
    person.profilePath = personResponse.profile_path;

    const alsoKnownAs: UniqueSet<PartialPersonAlsoKnownAs> = new UniqueSet();

    personResponse.also_known_as.forEach((value) => {
      alsoKnownAs.add({
        name: value,
      });
    });

    const images: UniqueSet<PartialPersonImage> = new UniqueSet();

    personResponse.images.profiles.forEach((value) => {
      images.add({
        filePath: value.file_path,
        width: value.width,
        height: value.height,
        languageCode: value.iso_639_1,
      });
    });

    const externalIds: UniqueSet<PartialPersonExternalId> = new UniqueSet();

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

    person.alsoKnownAs = [...alsoKnownAs];
    person.images = [...images];
    person.externalIds = [...externalIds];

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
