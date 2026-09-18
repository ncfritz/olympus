import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export class Language {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 639-1 code of the language",
  })
  id: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The English name of the language",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the language in that language",
  })
  nativeName: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the language was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the language was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialLanguage extends OmitType(Language, [...AUDIT_FIELDS]) {}

export class LanguageAssociation {
  @ApiProperty({
    required: true,
    type: Language,
    description: "The associated language",
  })
  language: Language;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the language association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the language association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialLanguageAssociation extends OmitType(LanguageAssociation, [
  ...AUDIT_FIELDS,
  "language",
]) {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 639-1 code of the language",
  })
  languageCode: string;
}

export class CreateLanguageRequest {
  @ApiProperty({
    required: true,
    type: () => PartialLanguage,
    description: "The language to create",
  })
  language: PartialLanguage;
}

export class CreateLanguageResponse {
  @ApiProperty({
    required: true,
    type: () => Language,
    description: "The created language",
  })
  language: Language;
}

export class ListLanguagesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => Language,
    isArray: true,
    description: "The languages on the requested page",
  })
  languages: Language[];
}
