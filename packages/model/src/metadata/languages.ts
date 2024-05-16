import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../ModelCommon";

export class Language {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  nativeName: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialLanguage extends OmitType(Language, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CreateLanguageRequest {
  @ApiProperty({
    type: () => Language,
  })
  language: PartialLanguage;
}

export class CreateLanguageResponse {
  @ApiProperty({
    type: () => Language,
  })
  language: Language;
}

export class ListLanguagesResponse extends PaginatedResults {
  @ApiProperty({ type: () => Language, isArray: true })
  languages: Language[];
}
