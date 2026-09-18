import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
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
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the production company",
  })
  id: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the production company",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "A description of the production company",
  })
  description: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The location of the headquarters",
  })
  headquarters: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The URL of the official homepage",
  })
  homepage: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB path of the logo image",
  })
  logoPath: string;
}

export class SparseProductionCompany extends BaseProductionCompany {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the production company was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the production company was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => AlternativeName,
    isArray: true,
    description: "Alternative names the production company is known by",
  })
  alternativeNames: AlternativeName[];

  @ApiProperty({
    required: false,
    type: () => Country,
    description: "The country the production company originated in",
  })
  originCountry?: Country;
}

export class SparseProductionCompanyWithContentCounts extends SparseProductionCompany {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of movies in the library from the company",
  })
  moviesCount: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of TV series in the library from the company",
  })
  tvSeriesCount: number;
}

export class ProductionCompany extends SparseProductionCompany {
  @ApiProperty({
    required: true,
    type: () => IdentifiableImage,
    isArray: true,
    description: "Logos of the production company",
  })
  logos: IdentifiableImage[];
}

export class PartialProductionCompany extends BaseProductionCompany {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country the company originated in",
  })
  originCountry: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The TMDB ID of the parent production company",
  })
  parentCompanyId?: number;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeName,
    isArray: true,
    description: "Alternative names the production company is known by",
  })
  alternativeNames: PartialAlternativeName[];

  @ApiProperty({
    required: true,
    type: () => PartialIdentifiableImage,
    isArray: true,
    description: "Logos of the production company",
  })
  logos: PartialIdentifiableImage[];
}

export class FullProductionCompany extends ProductionCompany {
  @ApiProperty({
    type: () => SparseProductionCompany,
    required: false,
    description: "The parent company, if there is one",
  })
  parent?: SparseProductionCompany;

  @ApiProperty({
    type: () => SparseProductionCompanyWithContentCounts,
    isArray: true,
    required: true,
    description: "The company's subsidiaries",
  })
  children: SparseProductionCompanyWithContentCounts[];
}

export class ProductionCompanyAssociation {
  @ApiProperty({
    required: true,
    type: SparseProductionCompany,
    description: "The associated production company",
  })
  productionCompany: SparseProductionCompany;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the production company association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the production company association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialProductionCompanyAssociation extends OmitType(
  ProductionCompanyAssociation,
  [...AUDIT_FIELDS, "productionCompany"],
) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the production company",
  })
  productionCompanyId: number;
}

export class CreateProductionCompanyRequest {
  @ApiProperty({
    required: true,
    type: () => PartialProductionCompany,
    description: "The production company to create",
  })
  company: PartialProductionCompany;
}

export class CreateProductionCompanyResponse {
  @ApiProperty({
    required: true,
    type: () => SparseProductionCompany,
    description: "The created production company",
  })
  company: SparseProductionCompany;
}

export class DescribeProductionCompanyResponse {
  @ApiProperty({
    required: true,
    type: () => FullProductionCompany,
    description: "The requested production company",
  })
  company: FullProductionCompany;
}

export class ListProductionCompaniesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => SparseProductionCompanyWithContentCounts,
    isArray: true,
    required: true,
    description: "The production companies on the requested page",
  })
  companies: SparseProductionCompanyWithContentCounts[];
}

export class ListProductionCompanyMoviesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => SparseMovie,
    isArray: true,
    required: true,
    description: "The movies on the requested page",
  })
  movies: SparseMovie[];
}

export class ListProductionCompanyTvSeriesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => BaseTVSeries,
    isArray: true,
    required: true,
    description: "The TV series on the requested page",
  })
  tvSeries: BaseTVSeries[];
}
