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
import { BaseTVSeries } from "./tvSeries";

export class BaseNetwork {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  headquarters: string;

  @ApiProperty({ type: String })
  homepage: string;

  @ApiProperty({ type: String })
  logoPath: string;
}

export class Network extends BaseNetwork {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => AlternativeName,
    isArray: true,
  })
  alternativeNames: AlternativeName[];

  @ApiProperty({ type: () => IdentifiableImage, isArray: true })
  images: IdentifiableImage[];

  @ApiProperty({ type: () => Country })
  originCountry?: Country;
}

export class NetworkWithContentCounts extends Network {
  @ApiProperty({ type: Number, required: true })
  tvSeriesCount: number;
}

export class PartialNetwork extends BaseNetwork {
  @ApiProperty({ type: String })
  originCountry: string;

  @ApiProperty({
    type: () => PartialAlternativeName,
    isArray: true,
  })
  alternativeNames: PartialAlternativeName[];

  @ApiProperty({ type: () => PartialIdentifiableImage, isArray: true })
  images: PartialIdentifiableImage[];
}

export class CreateNetworkRequest {
  @ApiProperty({
    type: () => PartialNetwork,
  })
  network: PartialNetwork;
}

export class NetworkAssociation {
  @ApiProperty({ type: Network })
  network: Network;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialNetworkAssociation extends OmitType(NetworkAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "network",
]) {
  @ApiProperty({ type: Number })
  networkId: number;
}

export class CreateNetworkResponse {
  @ApiProperty({
    type: () => Network,
  })
  network: Network;
}

export class DescribeNetworkResponse {
  @ApiProperty({
    type: () => NetworkWithContentCounts,
    required: true,
  })
  network: NetworkWithContentCounts;
}

export class ListNetworksResponse extends PaginatedResults {
  @ApiProperty({
    type: () => NetworkWithContentCounts,
    isArray: true,
    required: true,
  })
  networks: NetworkWithContentCounts[];
}

export class ListNetworkTvSeriesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => BaseTVSeries,
    isArray: true,
    required: true,
  })
  tvSeries: BaseTVSeries[];
}
