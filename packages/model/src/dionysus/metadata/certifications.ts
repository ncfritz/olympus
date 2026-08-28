import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
import { Language } from "./languages";

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

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCertification extends OmitType(Certification, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CertificationAssociation {
  @ApiProperty({ required: true, type: Language })
  certification: Certification;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
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
