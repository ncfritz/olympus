import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

export class BaseProductionCompany {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  description: string;

  @ApiProperty({ type: String })
  headquarters: string;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: String })
  logoPath: string;
}

export class ProductionCompany extends BaseProductionCompany {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => ProductionCompanyAlternativeName,
    isArray: true,
  })
  alternativeNames: ProductionCompanyAlternativeName[];

  @ApiProperty({ type: () => ProductionCompanyLogo, isArray: true })
  logos: ProductionCompanyLogo[];
}

export class PartialProductionCompany extends BaseProductionCompany {
  @ApiProperty({ type: String })
  originCountry: string;

  @ApiProperty({ type: String })
  parentCompanyId: number;

  @ApiProperty({
    type: () => PartialProductionCompanyAlternativeName,
    isArray: true,
  })
  alternativeNames: PartialProductionCompanyAlternativeName[];

  @ApiProperty({ type: () => PartialProductionCompanyLogo, isArray: true })
  logos: PartialProductionCompanyLogo[];
}

export class ProductionCompanyAlternativeName {
  @ApiProperty({ type: Number })
  productionCompanyId: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialProductionCompanyAlternativeName extends OmitType(
  ProductionCompanyAlternativeName,
  ["createdTime", "lastUpdatedTime"],
) {}

export class ProductionCompanyLogo {
  @ApiProperty({ type: Number })
  productionCompanyId: number;

  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  filePath: string;

  @ApiProperty({ type: String })
  fileType: string;

  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({ type: Number })
  height: number;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialProductionCompanyLogo extends OmitType(
  ProductionCompanyLogo,
  ["createdTime", "lastUpdatedTime"],
) {}

export class CreateProductionCompanyRequest {
  @ApiProperty({
    type: () => PartialProductionCompany,
  })
  company: PartialProductionCompany;
}

export class CreateProductionCompanyResponse {
  @ApiProperty({
    type: () => ProductionCompany,
  })
  company: ProductionCompany;
}
