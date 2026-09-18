import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export enum CertificationType {
  TV = "TV",
  MOVIE = "Movie",
}

export class Certification {
  @ApiProperty({
    required: true,
    type: String,
    description:
      "The ISO 3166-1 code of the country whose rating system this belongs to",
  })
  country: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The rating, e.g. PG-13 or TV-MA",
  })
  certification: string;

  @ApiProperty({
    required: true,
    enum: () => CertificationType,
    enumName: "CertificationType",
    description: "Whether the rating applies to movies or TV",
  })
  type: CertificationType;

  @ApiProperty({
    required: true,
    type: Number,
    description:
      "The position of the rating in its country's scale, from least to most restrictive",
  })
  order: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "What the rating means",
  })
  meaning: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the certification was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the certification was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialCertification extends OmitType(Certification, [
  ...AUDIT_FIELDS,
]) {}

export class CertificationAssociation {
  @ApiProperty({
    required: true,
    type: () => Certification,
    description: "The associated certification",
  })
  certification: Certification;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the certification association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the certification association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class CreateCertificationRequest {
  @ApiProperty({
    required: true,
    type: () => PartialCertification,
    description: "The certification to create",
  })
  certification: PartialCertification;
}

export class CreateCertificationResponse {
  @ApiProperty({
    required: true,
    type: () => Certification,
    description: "The created certification",
  })
  certification: Certification;
}

export class GetCertificationResponse {
  @ApiProperty({
    required: true,
    type: () => Certification,
    description: "The requested certification",
  })
  certification: Certification;
}

export class ListCertificationsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => Certification,
    isArray: true,
    description: "The certifications on the requested page",
  })
  certifications: Certification[];
}
