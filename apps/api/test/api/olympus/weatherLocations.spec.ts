import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import * as jose from "jose";
import type { Test } from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { issueAccessToken } from "../../../src/auth/tokens/accessTokens";
import { SigningKeyService } from "../../../src/auth/tokens/SigningKeyService";
import {
  graphQlWeatherLocation,
  WEATHER_LOCATION_ID,
} from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const USER = "5f1a0c6e-0000-4000-8000-000000000001";
const OTHER_USER = "5f1a0c6e-0000-4000-8000-0000000000ff";
const SECOND_ID = "7d3e2a10-0000-4000-8000-000000000002";
const THIRD_ID = "7d3e2a10-0000-4000-8000-000000000003";

const newPlace = {
  label: "Sedona",
  placeId: "ChIJplace-sedona",
  placeName: "Sedona, AZ, USA",
  latitude: 34.8697,
  longitude: -111.761,
};

/**
 * The weather location operations over the real HTTP stack. Every one is the
 * caller's own: the user comes from the access token, and every Hasura
 * document is scoped by it.
 */
describe("Weather locations API", () => {
  let t: TestApp;
  let token: string;

  const tokenFor = (sub: string) =>
    issueAccessToken(t.app.get(SigningKeyService).require(), {
      sub,
      clientId: "olympus-site",
      sessionId: "9c2f4b1a-0000-4000-8000-0000000000aa",
      roles: ["user"],
      authTime: 1_790_000_000,
    });

  const as = (request: Test) => request.set("authorization", `Bearer ${token}`);

  beforeAll(async () => {
    const keys = mkdtempSync(join(tmpdir(), "auth-keys-"));
    const { privateKey } = await jose.generateKeyPair("ES256", {
      extractable: true,
    });
    writeFileSync(
      join(keys, "2026-01-01.pem"),
      await jose.exportPKCS8(privateKey),
    );
    t = await createTestApp({ env: { AUTH_SIGNING_KEYS: keys } });
    token = await tokenFor(USER);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => t.reset());

  describe("without an identity", () => {
    it.each([
      ["get", "/v1/olympus/weather/locations"],
      ["post", "/v1/olympus/weather/locations"],
      ["put", "/v1/olympus/weather/locations/order"],
      ["get", `/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`],
      ["put", `/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`],
      ["delete", `/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await t.http()[method](path);
        expect(res.status).toBe(401);
        expect(t.graphql.calls("ListWeatherLocations")).toHaveLength(0);
        expect(t.graphql.calls("DescribeWeatherLocation")).toHaveLength(0);
      },
    );
  });

  describe("ListWeatherLocations", () => {
    it("lists the caller's locations in order", async () => {
      t.graphql.on("ListWeatherLocations", {
        olympus_weather_locations: [
          graphQlWeatherLocation(),
          graphQlWeatherLocation({
            id: SECOND_ID,
            label: "Bath - England",
            position: 1,
            isDefault: false,
          }),
        ],
      });

      const res = await as(t.http().get("/v1/olympus/weather/locations"));

      expect(res.status).toBe(200);
      expect(
        res.body.weatherLocations.map((l: { label: string }) => l.label),
      ).toEqual(["Washington", "Bath - England"]);
      expect(t.graphql.calls("ListWeatherLocations")[0].variables).toEqual({
        userId: USER,
      });
    });
  });

  describe("DescribeWeatherLocation", () => {
    it("returns the location, scoped to the caller", async () => {
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [graphQlWeatherLocation()],
      });

      const res = await as(
        t.http().get(`/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.weatherLocation).toMatchObject({
        id: WEATHER_LOCATION_ID,
        label: "Washington",
        isDefault: true,
      });
      expect(t.graphql.calls("DescribeWeatherLocation")[0].variables).toEqual({
        userId: USER,
        locationId: WEATHER_LOCATION_ID,
      });
    });

    it("answers 404 for someone else's location", async () => {
      // Scoped by the caller, another user's row simply isn't returned.
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [],
      });
      token = await tokenFor(OTHER_USER);
      try {
        const res = await as(
          t.http().get(`/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`),
        );
        expect(res.status).toBe(404);
        expect(t.graphql.calls("DescribeWeatherLocation")[0].variables).toEqual(
          { userId: OTHER_USER, locationId: WEATHER_LOCATION_ID },
        );
      } finally {
        token = await tokenFor(USER);
      }
    });

    it("answers 400 for an ID that is not a UUID, before Hasura", async () => {
      const res = await as(t.http().get("/v1/olympus/weather/location/nope"));
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeWeatherLocation")).toHaveLength(0);
    });
  });

  describe("CreateWeatherLocation", () => {
    it("makes the first location the default, at position 0", async () => {
      t.graphql.on("GetWeatherLocationPositions", {
        olympus_weather_locations_aggregate: {
          aggregate: { count: 0, max: { position: null } },
        },
      });
      t.graphql.on("CreateWeatherLocation", (vars) => ({
        insert_olympus_weather_locations_one: graphQlWeatherLocation({
          ...(vars as { object: object }).object,
        }),
      }));

      const res = await as(
        t
          .http()
          .post("/v1/olympus/weather/locations")
          .send({ weatherLocation: { ...newPlace, label: "  Sedona  " } }),
      );

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`,
      );
      expect(t.graphql.calls("CreateWeatherLocation")[0].variables).toEqual({
        object: {
          userId: USER,
          ...newPlace,
          position: 0,
          isDefault: true,
        },
      });
    });

    it("appends later locations after the last, not as the default", async () => {
      t.graphql.on("GetWeatherLocationPositions", {
        olympus_weather_locations_aggregate: {
          aggregate: { count: 2, max: { position: 4 } },
        },
      });
      t.graphql.on("CreateWeatherLocation", {
        insert_olympus_weather_locations_one: graphQlWeatherLocation({
          position: 5,
          isDefault: false,
        }),
      });

      const res = await as(
        t
          .http()
          .post("/v1/olympus/weather/locations")
          .send({ weatherLocation: newPlace }),
      );

      expect(res.status).toBe(201);
      const { object } = t.graphql.calls("CreateWeatherLocation")[0]
        .variables as { object: { position: number; isDefault: boolean } };
      expect(object.position).toBe(5);
      expect(object.isDefault).toBe(false);
    });

    it("keeps an optional Google place empty rather than blank", async () => {
      t.graphql.on("GetWeatherLocationPositions", {
        olympus_weather_locations_aggregate: {
          aggregate: { count: 1, max: { position: 0 } },
        },
      });
      t.graphql.on("CreateWeatherLocation", {
        insert_olympus_weather_locations_one: graphQlWeatherLocation(),
      });

      await as(
        t
          .http()
          .post("/v1/olympus/weather/locations")
          .send({
            weatherLocation: {
              label: "Here",
              placeId: "",
              latitude: 0,
              longitude: 0,
            },
          }),
      );

      const { object } = t.graphql.calls("CreateWeatherLocation")[0]
        .variables as { object: Record<string, unknown> };
      expect(object.placeId).toBeNull();
      expect(object.placeName).toBeNull();
    });

    it.each([
      ["no body", undefined],
      ["a blank label", { ...newPlace, label: "   " }],
      ["a latitude out of range", { ...newPlace, latitude: 91 }],
      ["a longitude that is text", { ...newPlace, longitude: "-111" }],
      ["a label that is too long", { ...newPlace, label: "x".repeat(101) }],
    ])("answers 400 for %s, before Hasura", async (_case, weatherLocation) => {
      const res = await as(
        t
          .http()
          .post("/v1/olympus/weather/locations")
          .send(weatherLocation === undefined ? {} : { weatherLocation }),
      );
      expect(res.status).toBe(400);
      expect(t.graphql.calls("GetWeatherLocationPositions")).toHaveLength(0);
      expect(t.graphql.calls("CreateWeatherLocation")).toHaveLength(0);
    });
  });

  describe("UpdateWeatherLocation", () => {
    const path = `/v1/olympus/weather/location/${SECOND_ID}`;
    const second = graphQlWeatherLocation({
      id: SECOND_ID,
      label: "Arizona",
      position: 1,
      isDefault: false,
    });

    it("relabels without touching the default", async () => {
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [second],
      });
      t.graphql.on("UpdateWeatherLocation", {
        update_olympus_weather_locations: {
          returning: [{ ...second, label: "Tempe" }],
        },
      });

      const res = await as(
        t
          .http()
          .put(path)
          .send({ weatherLocation: { label: " Tempe " } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.weatherLocation.label).toBe("Tempe");
      expect(t.graphql.calls("UpdateWeatherLocation")[0].variables).toEqual({
        userId: USER,
        locationId: SECOND_ID,
        set: { label: "Tempe" },
      });
      expect(t.graphql.calls("SetDefaultWeatherLocation")).toHaveLength(0);
    });

    it("clears the old default when it sets a new one", async () => {
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [second],
      });
      t.graphql.on("SetDefaultWeatherLocation", {
        clear: { affected_rows: 1 },
        update_olympus_weather_locations: {
          returning: [{ ...second, isDefault: true }],
        },
      });

      const res = await as(
        t
          .http()
          .put(path)
          .send({ weatherLocation: { isDefault: true } }),
      );

      expect(res.status).toBe(200);
      expect(res.body.weatherLocation.isDefault).toBe(true);
      const call = t.graphql.calls("SetDefaultWeatherLocation")[0];
      expect(call.variables).toEqual({
        userId: USER,
        locationId: SECOND_ID,
        set: { isDefault: true },
      });
      // The clear comes first: the one-default index needs it.
      expect(call.document.indexOf("clear:")).toBeLessThan(
        call.document.lastIndexOf("update_olympus_weather_locations("),
      );
    });

    it("answers 304 when the request names nothing to change", async () => {
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [second],
      });
      const res = await as(t.http().put(path).send({ weatherLocation: {} }));
      expect(res.status).toBe(304);
      expect(t.graphql.calls("UpdateWeatherLocation")).toHaveLength(0);
    });

    it("writes nothing when the changes match what is stored", async () => {
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [second],
      });
      const res = await as(
        t
          .http()
          .put(path)
          .send({ weatherLocation: { label: "Arizona", isDefault: false } }),
      );
      expect(res.status).toBe(200);
      expect(t.graphql.calls("UpdateWeatherLocation")).toHaveLength(0);
    });

    it("answers 404 for a location that isn't the caller's", async () => {
      t.graphql.on("DescribeWeatherLocation", {
        olympus_weather_locations: [],
      });
      const res = await as(
        t
          .http()
          .put(path)
          .send({ weatherLocation: { isDefault: true } }),
      );
      expect(res.status).toBe(404);
      expect(t.graphql.calls("DescribeWeatherLocation")).toHaveLength(1);
      expect(t.graphql.calls("SetDefaultWeatherLocation")).toHaveLength(0);
    });

    it("answers 400 for a default that isn't a boolean, before Hasura", async () => {
      const res = await as(
        t
          .http()
          .put(path)
          .send({ weatherLocation: { isDefault: "yes" } }),
      );
      expect(res.status).toBe(400);
      expect(t.graphql.calls("DescribeWeatherLocation")).toHaveLength(0);
    });
  });

  describe("DeleteWeatherLocation", () => {
    it("removes the caller's location", async () => {
      t.graphql.on("DeleteWeatherLocation", {
        delete_olympus_weather_locations: { affected_rows: 1 },
      });
      const res = await as(
        t.http().delete(`/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`),
      );
      expect(res.status).toBe(204);
      expect(t.graphql.calls("DeleteWeatherLocation")[0].variables).toEqual({
        userId: USER,
        locationId: WEATHER_LOCATION_ID,
      });
    });

    it("answers 404 when nothing of the caller's was removed", async () => {
      t.graphql.on("DeleteWeatherLocation", {
        delete_olympus_weather_locations: { affected_rows: 0 },
      });
      const res = await as(
        t.http().delete(`/v1/olympus/weather/location/${WEATHER_LOCATION_ID}`),
      );
      expect(res.status).toBe(404);
      expect(t.graphql.calls("DeleteWeatherLocation")).toHaveLength(1);
    });
  });

  describe("ReorderWeatherLocations", () => {
    const rows = [
      graphQlWeatherLocation(),
      graphQlWeatherLocation({ id: SECOND_ID, position: 1, isDefault: false }),
      graphQlWeatherLocation({ id: THIRD_ID, position: 2, isDefault: false }),
    ];

    it("sets each location's position from the order given", async () => {
      t.graphql.on("ListWeatherLocations", { olympus_weather_locations: rows });
      t.graphql.on("ReorderWeatherLocations", {
        update_olympus_weather_locations_many: [{ affected_rows: 1 }],
      });

      const res = await as(
        t
          .http()
          .put("/v1/olympus/weather/locations/order")
          .send({ locationIds: [THIRD_ID, WEATHER_LOCATION_ID, SECOND_ID] }),
      );

      expect(res.status).toBe(200);
      expect(t.graphql.calls("ReorderWeatherLocations")[0].variables).toEqual({
        updates: [THIRD_ID, WEATHER_LOCATION_ID, SECOND_ID].map(
          (id, position) => ({
            where: { id: { _eq: id }, userId: { _eq: USER } },
            _set: { position },
          }),
        ),
      });
    });

    it.each([
      ["one missing", [THIRD_ID, SECOND_ID]],
      ["one repeated", [THIRD_ID, SECOND_ID, SECOND_ID]],
      [
        "one that isn't the caller's",
        [THIRD_ID, SECOND_ID, "7d3e2a10-0000-4000-8000-0000000000ff"],
      ],
    ])("answers 400 for a list with %s", async (_case, locationIds) => {
      t.graphql.on("ListWeatherLocations", { olympus_weather_locations: rows });
      const res = await as(
        t
          .http()
          .put("/v1/olympus/weather/locations/order")
          .send({ locationIds }),
      );
      expect(res.status).toBe(400);
      expect(t.graphql.calls("ReorderWeatherLocations")).toHaveLength(0);
    });

    it("answers 400 for a body that isn't a list, before Hasura", async () => {
      const res = await as(
        t
          .http()
          .put("/v1/olympus/weather/locations/order")
          .send({ locationIds: "all" }),
      );
      expect(res.status).toBe(400);
      expect(t.graphql.calls("ListWeatherLocations")).toHaveLength(0);
    });
  });
});
