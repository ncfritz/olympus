import { AUDIT_FIELDS } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
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
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  headquarters: string;

  @ApiProperty({ required: true, type: String })
  homepage: string;

  @ApiProperty({ required: true, type: String })
  logoPath: string;
}

export class Network extends BaseNetwork {
  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => AlternativeName,
    isArray: true,
  })
  alternativeNames: AlternativeName[];

  @ApiProperty({ required: true, type: () => IdentifiableImage, isArray: true })
  images: IdentifiableImage[];

  @ApiProperty({ required: false, type: () => Country })
  originCountry?: Country;
}

export class NetworkWithContentCounts extends Network {
  @ApiProperty({ type: Number, required: true })
  tvSeriesCount: number;
}

export class PartialNetwork extends BaseNetwork {
  @ApiProperty({ required: true, type: String })
  originCountry: string;

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
  images: PartialIdentifiableImage[];
}

export class CreateNetworkRequest {
  @ApiProperty({
    required: true,
    type: () => PartialNetwork,
  })
  network: PartialNetwork;
}

export class NetworkAssociation {
  @ApiProperty({ required: true, type: Network })
  network: Network;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialNetworkAssociation extends OmitType(NetworkAssociation, [
  ...AUDIT_FIELDS,
  "network",
]) {
  @ApiProperty({ required: true, type: Number })
  networkId: number;
}

export class CreateNetworkResponse {
  @ApiProperty({
    required: true,
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
