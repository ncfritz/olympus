import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";

export class Language {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  nativeName: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialLanguage extends OmitType(Language, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class LanguageAssociation {
  @ApiProperty({ required: true, type: Language })
  language: Language;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialLanguageAssociation extends OmitType(LanguageAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "language",
]) {
  @ApiProperty({ required: true, type: String })
  languageCode: string;
}

export class CreateLanguageRequest {
  @ApiProperty({
    required: true,
    type: () => PartialLanguage,
  })
  language: PartialLanguage;
}

export class CreateLanguageResponse {
  @ApiProperty({
    required: true,
    type: () => Language,
  })
  language: Language;
}

export class ListLanguagesResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => Language, isArray: true })
  languages: Language[];
}
