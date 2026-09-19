import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  newznabAttribute,
  NzbGeekClient,
} from "../../../../src/search/services/NzbGeekClient";

vi.mock("axios", () => ({ default: { get: vi.fn() } }));

const client = new NzbGeekClient({
  apiUrl: "https://indexer.test/api",
  apiKey: "KEY",
});

describe("NzbGeekClient", () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.get).mockResolvedValue({
      status: 200,
      data: { channel: {} },
    });
  });

  it("searches movies by IMDb ID", async () => {
    await expect(client.searchMovie("0133093")).resolves.toEqual({
      status: 200,
      data: { channel: {} },
    });
    expect(axios.get).toHaveBeenCalledWith(
      "https://indexer.test/api?t=movie&imdbid=0133093&limit=200&offset=0&extended=1&o=json&apikey=KEY",
    );
  });

  it("searches TV episodes by TVDB ID and SxxEyy", async () => {
    await client.searchTvEpisode("73244", "S05E14");
    expect(axios.get).toHaveBeenCalledWith(
      "https://indexer.test/api?t=tvsearch&q=S05E14&tvdbid=73244&limit=200&offset=0&extended=1&o=json&apikey=KEY",
    );
  });
});

describe("newznabAttribute", () => {
  const item = {
    title: "t",
    attr: [
      { "@attributes": { name: "guid", value: "abc" } },
      { "@attributes": { name: "size", value: "100" } },
    ],
  };

  it("finds an attribute by name", () => {
    expect(newznabAttribute(item, "size")).toBe("100");
    expect(newznabAttribute(item, "password")).toBeUndefined();
  });
});
