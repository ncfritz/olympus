import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";

export class Country {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCountry extends OmitType(Country, [
  "createdTime",
  "lastUpdatedTime",
]) {}

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

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCountryAssociation extends OmitType(CountryAssociation, [
  "createdTime",
  "lastUpdatedTime",
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
