import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export class Language {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  nativeName: string;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialLanguage extends OmitType(Language, [...AUDIT_FIELDS]) {}

export class LanguageAssociation {
  @ApiProperty({ required: true, type: Language })
  language: Language;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialLanguageAssociation extends OmitType(LanguageAssociation, [
  ...AUDIT_FIELDS,
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
