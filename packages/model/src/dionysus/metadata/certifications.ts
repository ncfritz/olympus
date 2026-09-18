import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export enum CertificationType {
  TV = "TV",
  MOVIE = "Movie",
}

export class Certification {
  @ApiProperty({ required: true, type: String })
  country: string;

  @ApiProperty({ required: true, type: String })
  certification: string;

  @ApiProperty({
    required: true,
    enum: () => CertificationType,
    enumName: "CertificationType",
  })
  type: CertificationType;

  @ApiProperty({ required: true, type: Number })
  order: number;

  @ApiProperty({ required: true, type: String })
  meaning: string;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialCertification extends OmitType(Certification, [
  ...AUDIT_FIELDS,
]) {}

export class CertificationAssociation {
  @ApiProperty({ required: true, type: () => Certification })
  certification: Certification;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class CreateCertificationRequest {
  @ApiProperty({
    required: true,
    type: () => PartialCertification,
  })
  certification: PartialCertification;
}

export class CreateCertificationResponse {
  @ApiProperty({
    required: true,
    type: () => Certification,
  })
  certification: Certification;
}

export class GetCertificationResponse {
  @ApiProperty({
    required: true,
    type: () => Certification,
  })
  certification: Certification;
}

export class ListCertificationsResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => Certification, isArray: true })
  certifications: Certification[];
}
