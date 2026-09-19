import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  newznabAttribute,
  NzbGeekClient,
} from "../../../../src/search/services/NzbGeekClient";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, default: { get: vi.fn() } };
});

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
    expect(axios.get).toHaveBeenCalledWith("https://indexer.test/api", {
      params: {
        t: "movie",
        imdbid: "0133093",
        limit: 200,
        offset: 0,
        extended: 1,
        o: "json",
        apikey: "KEY",
      },
    });
  });

  it("searches TV episodes by TVDB ID and SxxEyy", async () => {
    await client.searchTvEpisode("73244", "S05E14");
    expect(axios.get).toHaveBeenCalledWith("https://indexer.test/api", {
      params: expect.objectContaining({
        t: "tvsearch",
        q: "S05E14",
        tvdbid: "73244",
      }),
    });
  });

  it("keeps the API key out of failures", async () => {
    const { AxiosError } =
      await vi.importActual<typeof import("axios")>("axios");
    const url = "https://indexer.test/api?t=movie&apikey=KEY";
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError(
        "Request failed with status code 401",
        "ERR_BAD_REQUEST",
        { url, params: { apikey: "KEY" } } as never,
        { path: url },
        { status: 401 } as never,
      ),
    );

    const error = await client.searchMovie("0133093").catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("NZBGeek movie search failed: 401");
    expect(JSON.stringify({ ...error, stack: error.stack })).not.toContain(
      "KEY",
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
