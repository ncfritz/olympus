import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { GenreCountStatistic, GenreStatistic } from "./common";

export enum GenreType {
  TV = "TV",
  MOVIE = "Movie",
}

export class Genre {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the genre",
  })
  id: number;

  @ApiProperty({
    required: true,
    enum: () => GenreType,
    enumName: "GenreType",
    description: "Whether the genre applies to movies or TV",
  })
  type: GenreType;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the genre",
  })
  name: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the genre was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the genre was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialGenre extends OmitType(Genre, [...AUDIT_FIELDS]) {}

export class GenreAssociation {
  @ApiProperty({
    required: true,
    type: Genre,
    description: "The associated genre",
  })
  genre: Genre;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the genre association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the genre association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialGenreAssociation extends OmitType(GenreAssociation, [
  ...AUDIT_FIELDS,
  "genre",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the genre",
  })
  genreId: number;
}

export class CreateGenreRequest {
  @ApiProperty({
    required: true,
    type: () => PartialGenre,
    description: "The genre to create",
  })
  genre: PartialGenre;
}

export class CreateGenreResponse {
  @ApiProperty({
    required: true,
    type: () => Genre,
    description: "The created genre",
  })
  genre: Genre;
}

export class ListGenresResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => Genre,
    isArray: true,
    description: "The genres on the requested page",
  })
  genres: Genre[];
}

export class GetMovieGenreCountStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreCountStatistic,
    isArray: true,
    description: "Movie counts by number of genres",
  })
  statistics: GenreCountStatistic[];
}

export class GetTvSeriesGenreCountStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreCountStatistic,
    isArray: true,
    description: "TV series counts by number of genres",
  })
  statistics: GenreCountStatistic[];
}

export class GetMovieGenreStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreStatistic,
    isArray: true,
    description: "Movie counts by genre",
  })
  statistics: GenreStatistic[];
}

export class GetTvSeriesGenreStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreStatistic,
    isArray: true,
    description: "TV series counts by genre",
  })
  statistics: GenreStatistic[];
}
