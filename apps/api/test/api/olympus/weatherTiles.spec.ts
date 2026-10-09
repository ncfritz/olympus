import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import { OpenWeatherClient } from "../../../src/olympus/weather/providers/OpenWeatherClient";
import { ProviderError } from "../../../src/olympus/weather/providers/ProviderError";
import { RainViewerClient } from "../../../src/olympus/weather/providers/RainViewerClient";
import { createTestApp, type TestApp } from "../../support/testApp";

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const LATEST = Math.floor(Date.now() / 1000) - 120;

/** The map layer and radar routes over the real HTTP stack, providers faked. */
describe("Weather tiles API", () => {
  let t: TestApp;
  let token: string;
  const openWeather = { configured: true, tile: vi.fn(), snapshot: vi.fn() };
  const rainViewer = {
    maps: vi.fn(async () => ({
      version: "2.0",
      generated: LATEST,
      host: "https://tilecache.rainviewer.com",
      radar: {
        past: [
          { time: LATEST - 600, path: `/v2/radar/${LATEST - 600}` },
          { time: LATEST, path: `/v2/radar/${LATEST}` },
        ],
      },
    })),
    tile: vi.fn(),
  };

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({
      env: { AUTH_SIGNING_KEYS: keys },
      overrides: [
        { provide: OpenWeatherClient, useValue: openWeather },
        { provide: RainViewerClient, useValue: rainViewer },
      ],
    });
    token = await issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub: "5f1a0c6e-0000-4000-8000-000000000001",
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles: ["user"],
      authTime: 1_790_000_000,
    });
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.reset();
    openWeather.tile.mockReset().mockResolvedValue(PNG);
    rainViewer.tile.mockReset().mockResolvedValue(PNG);
  });

  const get = (path: string) =>
    t
      .http()
      .get(path)
      .set("authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });

  it("serves a layer tile as a PNG the browser may cache privately", async () => {
    const res = await get("/v1/olympus/weather/map/precipitation/8/41/89");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toBe("private, max-age=1800");
    expect((res.body as Buffer).equals(PNG)).toBe(true);
    expect(openWeather.tile).toHaveBeenCalledWith("precipitation", 8, 41, 89);
  });

  it("answers 400 for an unknown layer or a tile off the map", async () => {
    expect((await get("/v1/olympus/weather/map/humidity/8/1/1")).status).toBe(
      400,
    );
    expect((await get("/v1/olympus/weather/map/clouds/2/9/0")).status).toBe(
      400,
    );
    expect((await get("/v1/olympus/weather/map/clouds/x/1/1")).status).toBe(
      400,
    );
    expect(openWeather.tile).not.toHaveBeenCalled();
  });

  it("answers 503 when the provider is failing", async () => {
    openWeather.tile.mockRejectedValue(
      new ProviderError("openweather", "unavailable", 502),
    );
    const res = await get("/v1/olympus/weather/map/clouds/8/3/3");
    expect(res.status).toBe(503);
  });

  it("lists the radar frames", async () => {
    const res = await t
      .http()
      .get("/v1/olympus/weather/radar/frames")
      .set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.radarFrames.map((f: { id: string }) => f.id)).toEqual([
      String(LATEST - 600),
      String(LATEST),
    ]);
  });

  it("serves a radar tile for a listed frame, and refuses zoom 8", async () => {
    const ok = await get(`/v1/olympus/weather/radar/${LATEST}/7/20/44`);
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/png");
    const tooClose = await get(`/v1/olympus/weather/radar/${LATEST}/8/40/88`);
    expect(tooClose.status).toBe(400);
    const gone = await get("/v1/olympus/weather/radar/1234/7/20/44");
    expect(gone.status).toBe(404);
  });

  it.each([
    "/v1/olympus/weather/map/clouds/8/1/1",
    "/v1/olympus/weather/radar/frames",
    `/v1/olympus/weather/radar/${LATEST}/7/1/1`,
  ])("answers 401 without an identity: %s", async (path) => {
    expect((await t.http().get(path)).status).toBe(401);
  });
});
