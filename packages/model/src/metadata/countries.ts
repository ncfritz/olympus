import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../ModelCommon";

export class Country {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCountry extends OmitType(Country, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CreateCountryRequest {
  @ApiProperty({
    type: () => Country,
  })
  country: PartialCountry;
}

export class CreateCountryResponse {
  @ApiProperty({
    type: () => Country,
  })
  country: Country;
}

export class ListCountriesResponse extends PaginatedResults {
  @ApiProperty({ type: () => Country, isArray: true })
  countries: Country[];
}
