import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";

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
    type: () => NetworkAlternativeName,
    isArray: true,
  })
  alternativeNames: NetworkAlternativeName[];

  @ApiProperty({ type: () => NetworkImage, isArray: true })
  logos: NetworkImage[];
}

export class PartialNetwork extends BaseNetwork {
  @ApiProperty({ type: String })
  originCountry: string;

  @ApiProperty({
    type: () => PartialNetworkAlternativeName,
    isArray: true,
  })
  alternativeNames: PartialNetworkAlternativeName[];

  @ApiProperty({ type: () => PartialNetworkImage, isArray: true })
  logos: PartialNetworkImage[];
}

export class NetworkAlternativeName {
  @ApiProperty({ type: Number })
  networkId: number;

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

export class PartialNetworkAlternativeName extends OmitType(
  NetworkAlternativeName,
  ["createdTime", "lastUpdatedTime"],
) {}

export class NetworkImage {
  @ApiProperty({ type: Number })
  networkId: number;

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

export class PartialNetworkImage extends OmitType(NetworkImage, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class CreateNetworkRequest {
  @ApiProperty({
    type: () => PartialNetwork,
  })
  network: PartialNetwork;
}

export class CreateNetworkResponse {
  @ApiProperty({
    type: () => Network,
  })
  network: Network;
}
