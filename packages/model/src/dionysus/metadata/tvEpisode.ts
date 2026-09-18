import { AUDIT_FIELDS } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import {
  MediaAsset,
  MediaAssetSearchConfiguration,
  SparseMediaFavorite,
} from "../media";
import {
  ExternalId,
  PartialExternalId,
  PartialTypedImage,
  PartialVideo,
  TypedImage,
  Video,
} from "./common";
import { BasePerson } from "./people";
import { SparseSeason } from "./tvSeason";
import { BaseTVSeries } from "./tvSeries";

export class BaseEpisode {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the episode",
  })
  id: number;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the episode first aired",
  })
  airDate?: Moment;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The episode's number within its season",
  })
  episodeNumber: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the episode",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "A summary of the episode",
  })
  overview: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The studio's production code",
  })
  productionCode: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The runtime in minutes",
  })
  runtime: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of the season the episode belongs to",
  })
  seasonNumber: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The TMDB path of the episode's still image",
  })
  stillPath?: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of TMDB user ratings",
  })
  voteCount: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average TMDB user rating, from 0 to 10",
  })
  voteAverage: number;
}

export class SparseEpisode extends BaseEpisode {
  @ApiProperty({
    type: () => MediaAssetSearchConfiguration,
    required: false,
    description:
      "The media search configuration for the episode, if there is one",
  })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
    description: "The favorite record, if the episode is marked as a favorite",
  })
  favorite?: SparseMediaFavorite;

  @ApiProperty({
    type: () => MediaAsset,
    required: false,
    description:
      "The media asset in the library for the episode, if there is one",
  })
  asset?: MediaAsset;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the episode was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the episode was last updated",
  })
  lastUpdatedTime: Moment;
}

export class Episode extends SparseEpisode {
  @ApiProperty({
    required: true,
    type: () => BaseTVSeries,
    description: "The TV series the episode belongs to",
  })
  series: BaseTVSeries;

  @ApiProperty({
    required: true,
    type: () => SparseSeason,
    description: "The season the episode belongs to",
  })
  season: SparseSeason;

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
    description:
      "IDs of the episode in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
    description: "Images of the episode",
  })
  images: TypedImage[];

  @ApiProperty({
    required: true,
    type: () => Video,
    isArray: true,
    description: "Videos such as trailers and clips",
  })
  videos: Video[];
}

export class PartialEpisode extends BaseEpisode {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the season",
  })
  seasonId: number;

  @ApiProperty({
    required: true,
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: PartialTVEpisodeCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTVEpisodeCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: PartialTVEpisodeCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
    description:
      "IDs of the episode in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialTVEpisodeCastMember,
    isArray: true,
    description: "Guest stars who appear in the episode",
  })
  guestStars: PartialTVEpisodeCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
    description: "Images of the episode",
  })
  images: PartialTypedImage[];

  @ApiProperty({
    required: true,
    type: () => PartialVideo,
    isArray: true,
    description: "Videos such as trailers and clips",
  })
  videos: PartialVideo[];
}

export class TVEpisodeCrewMember {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The job performed",
  })
  job: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The department the job belongs to",
  })
  department: string;

  @ApiProperty({
    required: true,
    type: () => BasePerson,
    description: "The credited person",
  })
  person: BasePerson;

  @ApiProperty({
    required: true,
    type: String,
    description: "The person's name as credited in the original language",
  })
  originalName: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV episode crew member was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV episode crew member was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialTVEpisodeCrewMember extends OmitType(TVEpisodeCrewMember, [
  ...AUDIT_FIELDS,
  "person",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  personId: number;
}

export class SparseTVEpisodeCastMember {
  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the character played",
  })
  character: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the credit",
  })
  creditId: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The billing order in the credits",
  })
  order: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The person's name as credited in the original language",
  })
  originalName: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV episode cast member was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the TV episode cast member was last updated",
  })
  lastUpdatedTime: Moment;
}

export class TVEpisodeCastMember extends SparseTVEpisodeCastMember {
  @ApiProperty({
    required: true,
    type: () => BasePerson,
    description: "The credited person",
  })
  person: BasePerson;
}

export class PartialTVEpisodeCastMember extends OmitType(TVEpisodeCastMember, [
  ...AUDIT_FIELDS,
  "person",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the person",
  })
  personId: number;
}

export class CreateTVEpisodeRequest {
  @ApiProperty({
    required: true,
    type: () => PartialEpisode,
    description: "The episode to create",
  })
  episode: PartialEpisode;
}

export class CreateTVEpisodeResponse {
  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The TMDB ID of the TV series",
  })
  seriesId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The TMDB ID of the season",
  })
  seasonId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The season number",
  })
  seasonNumber: number;

  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The TMDB ID of the created episode",
  })
  episodeId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The episode number",
  })
  episodeNumber: number;
}

export class DescribeTVEpisodeResponse {
  @ApiProperty({
    required: true,
    type: () => Episode,
    description: "The requested episode",
  })
  episode: Episode;
}

export class ListTVEpisodeCastResponse {
  @ApiProperty({
    required: true,
    type: () => TVEpisodeCastMember,
    isArray: true,
    description: "The episode's cast",
  })
  cast: TVEpisodeCastMember[];
}

export class ListTVEpisodeCrewResponse {
  @ApiProperty({
    required: true,
    type: () => TVEpisodeCrewMember,
    isArray: true,
    description: "The episode's crew",
  })
  crew: TVEpisodeCrewMember[];
}

export class ListTVEpisodeGuestStarsResponse {
  @ApiProperty({
    required: true,
    type: () => TVEpisodeCastMember,
    isArray: true,
    description: "The episode's guest stars",
  })
  guestStars: TVEpisodeCastMember[];
}
