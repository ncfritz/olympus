import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export class Country {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialCountry extends OmitType(Country, [...AUDIT_FIELDS]) {}

export class CreateCountryRequest {
  @ApiProperty({
    required: true,
    type: () => PartialCountry,
  })
  country: PartialCountry;
}

export class CountryAssociation {
  @ApiProperty({ required: true, type: Country })
  country: Country;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialCountryAssociation extends OmitType(CountryAssociation, [
  ...AUDIT_FIELDS,
  "country",
]) {
  @ApiProperty({ required: true, type: String })
  countryCode: string;
}

export class CreateCountryResponse {
  @ApiProperty({
    required: true,
    type: () => Country,
  })
  country: Country;
}

export class ListCountriesResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => Country, isArray: true })
  countries: Country[];
}
