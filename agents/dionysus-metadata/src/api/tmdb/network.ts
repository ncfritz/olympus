import { BaseEndpoint } from "tmdb-ts/dist/endpoints/base";
import { AlternativeNames, Images, Network } from "../../types/tmdb/networks";

const BASE_NETWORKS = "/network";

export class NetworksEndpoint extends BaseEndpoint {
  constructor(protected readonly accessToken: string) {
    super(accessToken);
  }

  async details(networkId: number): Promise<Network> {
    return await this.api.get<Network>(`${BASE_NETWORKS}/${networkId}`);
  }

  async images(networkId: number): Promise<Images> {
    return await this.api.get<Images>(`${BASE_NETWORKS}/${networkId}/images`);
  }

  async alternativeNames(networkId: number): Promise<AlternativeNames> {
    return await this.api.get<AlternativeNames>(
      `${BASE_NETWORKS}/${networkId}/alternative_names`
    );
  }
}
