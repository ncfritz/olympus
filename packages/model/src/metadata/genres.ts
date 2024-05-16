import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../ModelCommon";
import { Language } from "./languages";

export enum GenreType {
  TV = "TV",
  MOVIE = "Movie",
}

export class Genre {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ enum: GenreType })
  type: GenreType;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialGenre extends OmitType(Genre, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CreateGenreRequest {
  @ApiProperty({
    type: () => Language,
  })
  genre: PartialGenre;
}

export class CreateGenreResponse {
  @ApiProperty({
    type: () => Genre,
  })
  genre: Genre;
}

export class ListGenresResponse extends PaginatedResults {
  @ApiProperty({ type: () => Genre, isArray: true })
  genres: Genre[];
}
