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
import { BaseTVSeries } from "./tvSeries";

export class BaseNetwork {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the network",
  })
  id: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the network",
  })
  name: string;

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

export class Network extends BaseNetwork {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the network was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the network was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => AlternativeName,
    isArray: true,
    description: "Alternative names the network is known by",
  })
  alternativeNames: AlternativeName[];

  @ApiProperty({
    required: true,
    type: () => IdentifiableImage,
    isArray: true,
    description: "Images of the network",
  })
  images: IdentifiableImage[];

  @ApiProperty({
    required: false,
    type: () => Country,
    description: "The country the network originated in",
  })
  originCountry?: Country;
}

export class NetworkWithContentCounts extends Network {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The number of TV series in the library from the network",
  })
  tvSeriesCount: number;
}

export class PartialNetwork extends BaseNetwork {
  @ApiProperty({
    required: true,
    type: String,
    description: "The ISO 3166-1 code of the country the network originated in",
  })
  originCountry: string;

  @ApiProperty({
    required: true,
    type: () => PartialAlternativeName,
    isArray: true,
    description: "Alternative names the network is known by",
  })
  alternativeNames: PartialAlternativeName[];

  @ApiProperty({
    required: true,
    type: () => PartialIdentifiableImage,
    isArray: true,
    description: "Images of the network",
  })
  images: PartialIdentifiableImage[];
}

export class CreateNetworkRequest {
  @ApiProperty({
    required: true,
    type: () => PartialNetwork,
    description: "The network to create",
  })
  network: PartialNetwork;
}

export class NetworkAssociation {
  @ApiProperty({
    required: true,
    type: Network,
    description: "The associated network",
  })
  network: Network;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the network association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the network association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialNetworkAssociation extends OmitType(NetworkAssociation, [
  ...AUDIT_FIELDS,
  "network",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the network",
  })
  networkId: number;
}

export class CreateNetworkResponse {
  @ApiProperty({
    required: true,
    type: () => Network,
    description: "The created network",
  })
  network: Network;
}

export class DescribeNetworkResponse {
  @ApiProperty({
    type: () => NetworkWithContentCounts,
    required: true,
    description: "The requested network",
  })
  network: NetworkWithContentCounts;
}

export class ListNetworksResponse extends PaginatedResults {
  @ApiProperty({
    type: () => NetworkWithContentCounts,
    isArray: true,
    required: true,
    description: "The networks on the requested page",
  })
  networks: NetworkWithContentCounts[];
}

export class ListNetworkTvSeriesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => BaseTVSeries,
    isArray: true,
    required: true,
    description: "The TV series on the requested page",
  })
  tvSeries: BaseTVSeries[];
}
