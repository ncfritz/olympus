import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
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

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialGenre extends OmitType(Genre, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class GenreAssociation {
  @ApiProperty({ required: true, type: Genre })
  genre: Genre;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialGenreAssociation extends OmitType(GenreAssociation, [
  "createdTime",
  "lastUpdatedTime",
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
