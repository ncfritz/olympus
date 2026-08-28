import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";
import {
  AlternativeName,
  IdentifiableImage,
  PartialAlternativeName,
  PartialIdentifiableImage,
} from "./common";
import { Country } from "./countries";
import { SparseMovie } from "./movies";
import { BaseTVSeries } from "./tvSeries";

export class BaseProductionCompany {
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  description: string;

  @ApiProperty({ required: true, type: String })
  headquarters: string;

  @ApiProperty({ required: true, type: String })
  homepage: string;

  @ApiProperty({ required: true, type: String })
  logoPath: string;
}

export class SparseProductionCompany extends BaseProductionCompany {
  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => AlternativeName,
    isArray: true,
  })
  alternativeNames: AlternativeName[];

  @ApiProperty({ required: false, type: () => Country })
  originCountry?: Country;
}

export class SparseProductionCompanyWithContentCounts extends SparseProductionCompany {
  @ApiProperty({ type: Number, required: true })
  moviesCount: number;

  @ApiProperty({ type: Number, required: true })
  tvSeriesCount: number;
}

export class ProductionCompany extends SparseProductionCompany {
  @ApiProperty({ required: true, type: () => IdentifiableImage, isArray: true })
  logos: IdentifiableImage[];
}

export class PartialProductionCompany extends BaseProductionCompany {
  @ApiProperty({ required: true, type: String })
  originCountry: string;

  @ApiProperty({ type: Number, required: false })
  parentCompanyId?: number;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeName,
    isArray: true,
  })
  alternativeNames: PartialAlternativeName[];

  @ApiProperty({
    required: true,
    type: () => PartialIdentifiableImage,
    isArray: true,
  })
  logos: PartialIdentifiableImage[];
}

export class FullProductionCompany extends ProductionCompany {
  @ApiProperty({
    type: () => SparseProductionCompany,
    required: false,
  })
  parent?: SparseProductionCompany;

  @ApiProperty({
    type: () => SparseProductionCompanyWithContentCounts,
    isArray: true,
    required: true,
  })
  children: SparseProductionCompanyWithContentCounts[];
}

export class ProductionCompanyAssociation {
  @ApiProperty({ required: true, type: SparseProductionCompany })
  productionCompany: SparseProductionCompany;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialProductionCompanyAssociation extends OmitType(
  ProductionCompanyAssociation,
  ["createdTime", "lastUpdatedTime", "productionCompany"],
) {
  @ApiProperty({ required: true, type: Number })
  productionCompanyId: number;
}

export class CreateProductionCompanyRequest {
  @ApiProperty({
    required: true,
    type: () => PartialProductionCompany,
  })
  company: PartialProductionCompany;
}

export class CreateProductionCompanyResponse {
  @ApiProperty({
    required: true,
    type: () => SparseProductionCompany,
  })
  company: SparseProductionCompany;
}

export class DescribeProductionCompanyResponse {
  @ApiProperty({
    required: true,
    type: () => FullProductionCompany,
  })
  company: FullProductionCompany;
}

export class ListProductionCompaniesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => SparseProductionCompanyWithContentCounts,
    isArray: true,
    required: true,
  })
  companies: SparseProductionCompanyWithContentCounts[];
}

export class ListProductionCompanyMoviesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => SparseMovie,
    isArray: true,
    required: true,
  })
  movies: SparseMovie[];
}

export class ListProductionCompanyTvSeriesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => BaseTVSeries,
    isArray: true,
    required: true,
  })
  tvSeries: BaseTVSeries[];
}
