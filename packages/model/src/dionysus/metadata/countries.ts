import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export class Country {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country",
  })
  id: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the country",
  })
  name: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the country was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the country was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialCountry extends OmitType(Country, [...AUDIT_FIELDS]) {}

export class CreateCountryRequest {
  @ApiProperty({
    required: true,
    type: () => PartialCountry,
    description: "The country to create",
  })
  country: PartialCountry;
}

export class CountryAssociation {
  @ApiProperty({
    required: true,
    type: Country,
    description: "The associated country",
  })
  country: Country;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the country association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the country association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialCountryAssociation extends OmitType(CountryAssociation, [
  ...AUDIT_FIELDS,
  "country",
]) {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country",
  })
  countryCode: string;
}

export class CreateCountryResponse {
  @ApiProperty({
    required: true,
    type: () => Country,
    description: "The created country",
  })
  country: Country;
}

export class ListCountriesResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => Country,
    isArray: true,
    description: "The countries on the requested page",
  })
  countries: Country[];
}
