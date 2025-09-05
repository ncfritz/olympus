import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";

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

export class LanguageAssociation {
  @ApiProperty({ type: Language })
  language: Language;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialLanguageAssociation extends OmitType(LanguageAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "language",
]) {
  @ApiProperty({ type: String })
  languageCode: string;
}

export class CreateLanguageRequest {
  @ApiProperty({
    type: () => PartialLanguage,
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
