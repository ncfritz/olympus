import { ApiTimestamp } from "../../decorators";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { MediaAssetSearchConfiguration, SparseMediaFavorite } from "../media";
import {
  ExternalId,
  PartialExternalId,
  PartialTypedImage,
  PartialVideo,
  TypedImage,
  Video,
} from "./common";
import { SparseEpisode } from "./tvEpisode";
import {
  BaseTVSeries,
  PartialTVSeriesCastMember,
  PartialTVSeriesCrewMember,
  TVSeriesCastMember,
  TVSeriesCrewMember,
} from "./tvSeries";

export class BaseSeason {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the season",
  })
  id: number;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string indicating when the season first aired",
  })
  airDate?: Moment;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the season",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "A summary of the season",
  })
  overview: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The TMDB path of the poster image",
  })
  posterPath?: string;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The season number (0 for specials)",
  })
  seasonNumber: number;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The average TMDB user rating, from 0 to 10",
  })
  voteAverage: number;
}

export class SparseSeason extends BaseSeason {
  @ApiProperty({
    type: () => MediaAssetSearchConfiguration,
    required: false,
    description:
      "The media search configuration for the season, if there is one",
  })
  searchConfiguration?: MediaAssetSearchConfiguration;

  @ApiProperty({
    type: () => SparseMediaFavorite,
    required: false,
    description: "The favorite record, if the season is marked as a favorite",
  })
  favorite?: SparseMediaFavorite;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the season was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the season was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: Number,
    description: "The number of episodes in the season",
  })
  episodeCount: number;
}

export class Season extends SparseSeason {
  @ApiProperty({
    required: false,
    type: () => BaseTVSeries,
    description: "The TV series the season belongs to",
  })
  series?: BaseTVSeries;

  @ApiProperty({
    required: true,
    type: () => ExternalId,
    isArray: true,
    description:
      "IDs of the season in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: ExternalId[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
    description: "Images of the season",
  })
  images: TypedImage[];

  @ApiProperty({
    required: true,
    type: () => Video,
    isArray: true,
    description: "Videos such as trailers and clips",
  })
  videos: Video[];

  @ApiProperty({
    required: true,
    type: () => SparseEpisode,
    isArray: true,
    description: "The episodes in the season",
  })
  episodes: SparseEpisode[];
}

export class SeasonWithCastAndCrew extends Season {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: TVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: TVSeriesCrewMember[];
}

export class PartialSeason extends BaseSeason {
  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCastMember,
    isArray: true,
    description: "The cast",
  })
  cast: PartialTVSeriesCastMember[];

  @ApiProperty({
    required: true,
    type: () => PartialTVSeriesCrewMember,
    isArray: true,
    description: "The crew",
  })
  crew: PartialTVSeriesCrewMember[];

  @ApiProperty({
    required: true,
    type: () => PartialExternalId,
    isArray: true,
    description:
      "IDs of the season in other databases (IMDb, TVDB, social media, ...)",
  })
  externalIds: PartialExternalId[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
    description: "Images of the season",
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

export class CreateTVSeasonRequest {
  @ApiProperty({
    required: true,
    type: () => PartialSeason,
    description: "The season to create",
  })
  season: PartialSeason;
}

export class CreateTVSeasonResponse {
  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The TMDB ID of the TV series",
  })
  seriesId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The TMDB ID of the created season",
  })
  seasonId: number;

  @ApiProperty({
    required: true,
    type: () => Number,
    description: "The season number",
  })
  seasonNumber: number;
}

export class DescribeTVSeasonResponse {
  @ApiProperty({
    required: true,
    type: () => Season,
    description: "The requested season",
  })
  season: Season;
}

export class ListTvSeasonCastResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCastMember,
    isArray: true,
    description: "The season's cast",
  })
  cast: TVSeriesCastMember[];
}

export class ListTvSeasonCrewResponse {
  @ApiProperty({
    required: true,
    type: () => TVSeriesCrewMember,
    isArray: true,
    description: "The season's crew",
  })
  crew: TVSeriesCrewMember[];
}
