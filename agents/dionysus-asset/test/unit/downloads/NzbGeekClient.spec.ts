import axios, { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DownloadsConfigType } from "../../../src/config/configuration";
import { NzbGeekClient } from "../../../src/downloads/services/NzbGeekClient";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, default: { get: vi.fn() } };
});

const client = () =>
  new NzbGeekClient({ nzbGeekApiKey: "SECRET-KEY" } as DownloadsConfigType);

describe("NzbGeekClient", () => {
  afterEach(() => vi.mocked(axios.get).mockReset());

  it("fetches the NZB with the key as a parameter", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: "stream" });

    expect(await client().getNzb("abc")).toBe("stream");
    expect(axios.get).toHaveBeenCalledWith("https://api.nzbgeek.info/api", {
      params: { t: "get", id: "abc", apikey: "SECRET-KEY" },
      responseType: "stream",
    });
  });

  it("keeps the API key out of failures", async () => {
    const url = "https://api.nzbgeek.info/api?t=get&id=abc&apikey=SECRET-KEY";
    vi.mocked(axios.get).mockRejectedValue(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", { url } as never),
    );

    const error = await client()
      .getNzb("abc")
      .catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "NZBGeek NZB abc download failed: ERR_BAD_REQUEST",
    );
    expect(JSON.stringify(error)).not.toContain("SECRET-KEY");
    expect(String((error as Error).stack)).not.toContain("SECRET-KEY");
    expect((error as Error).cause).toBeUndefined();
  });
});
