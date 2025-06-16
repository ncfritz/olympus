import { AppendToResponse, AppendToResponsePersonKey } from "tmdb-ts";
import { BaseEndpoint } from "tmdb-ts/dist/endpoints/base";
import { Person } from "../../types/tmdb/person";

const BASE_PERSON = "/person";

export class PersonEndpoint extends BaseEndpoint {
  constructor(protected readonly accessToken: string) {
    super(accessToken);
  }

  async details<T extends AppendToResponsePersonKey[] | undefined>(
    id: number,
    appendToResponse?: T
  ) {
    const options = {
      append_to_response: appendToResponse
        ? appendToResponse.join(",")
        : undefined,
    };
    return await this.api.get<AppendToResponse<Person, T, "person">>(
      `${BASE_PERSON}/${id}`,
      options
    );
  }
}
