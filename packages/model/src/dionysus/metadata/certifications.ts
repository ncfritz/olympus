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
  @ApiProperty({ type: String })
  country: string;

  @ApiProperty({ type: String })
  certification: string;

  @ApiProperty({ enum: () => CertificationType, enumName: "CertificationType" })
  type: CertificationType;

  @ApiProperty({ type: Number })
  order: number;

  @ApiProperty({ type: String })
  meaning: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCertification extends OmitType(Certification, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CertificationAssociation {
  @ApiProperty({ type: Language })
  certification: Certification;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class CreateCertificationRequest {
  @ApiProperty({
    type: () => PartialCertification,
  })
  certification: PartialCertification;
}

export class CreateCertificationResponse {
  @ApiProperty({
    type: () => Certification,
  })
  certification: Certification;
}

export class GetCertificationResponse {
  @ApiProperty({
    type: () => Certification,
  })
  certification: Certification;
}

export class ListCertificationsResponse extends PaginatedResults {
  @ApiProperty({ type: () => Certification, isArray: true })
  certifications: Certification[];
}
