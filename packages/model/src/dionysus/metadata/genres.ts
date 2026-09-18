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
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, enum: () => GenreType, enumName: "GenreType" })
  type: GenreType;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialGenre extends OmitType(Genre, [...AUDIT_FIELDS]) {}

export class GenreAssociation {
  @ApiProperty({ required: true, type: Genre })
  genre: Genre;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialGenreAssociation extends OmitType(GenreAssociation, [
  ...AUDIT_FIELDS,
  "genre",
]) {
  @ApiProperty({ required: true, type: Number })
  genreId: number;
}

export class CreateGenreRequest {
  @ApiProperty({
    required: true,
    type: () => PartialGenre,
  })
  genre: PartialGenre;
}

export class CreateGenreResponse {
  @ApiProperty({
    required: true,
    type: () => Genre,
  })
  genre: Genre;
}

export class ListGenresResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => Genre, isArray: true })
  genres: Genre[];
}

export class GetMovieGenreCountStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreCountStatistic,
    isArray: true,
  })
  statistics: GenreCountStatistic[];
}

export class GetTvSeriesGenreCountStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreCountStatistic,
    isArray: true,
  })
  statistics: GenreCountStatistic[];
}

export class GetMovieGenreStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreStatistic,
    isArray: true,
  })
  statistics: GenreStatistic[];
}

export class GetTvSeriesGenreStatisticsResponse {
  @ApiProperty({
    required: true,
    type: () => GenreStatistic,
    isArray: true,
  })
  statistics: GenreStatistic[];
}
