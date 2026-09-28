import { describe, expect, it } from "vitest";
import {
  createOlympusClients,
  JobApi,
  MetadataApi,
  NotificationApi,
} from "../../src";
import { fakeApi } from "../support/fakeApi";

describe("createOlympusClients", () => {
  it("sends the caller's name and records the operation called", async () => {
    const api = fakeApi();
    api.reply(200, { movie: { id: 603, title: "The Matrix" } });

    await expect(
      new MetadataApi(api.clients).describeMovie(603),
    ).resolves.toEqual({ id: 603, title: "The Matrix" });

    expect(api.sent).toEqual([
      expect.objectContaining({
        method: "GET",
        url: "http://olympus-api:3100/v1/dionysus/metadata/movie/603",
        headers: expect.objectContaining({ "x-olympus-client": "test-agent" }),
      }),
    ]);
    expect(api.observed).toEqual([
      {
        client: "test-agent",
        server: "olympus-api",
        api: "dionysus",
        tag: expect.any(String),
        operation: "DescribeMovie",
        method: "GET",
        statusCode: 200,
        durationSeconds: expect.any(Number),
      },
    ]);
  });

  describe("auth", () => {
    it("sends the token the provider returns", async () => {
      const api = fakeApi(undefined, { auth: () => "a-token" });
      api.reply(200, { movie: { id: 603 } });
      await new MetadataApi(api.clients).describeMovie(603);
      expect(api.sent[0]?.headers).toMatchObject({
        authorization: "Bearer a-token",
      });
    });

    it("sends no header when there is no token yet", async () => {
      // Not signed in is the ordinary state, not an error: the request goes
      // out unauthenticated and the API decides.
      const api = fakeApi(undefined, { auth: () => undefined });
      api.reply(200, { movie: { id: 603 } });
      await new MetadataApi(api.clients).describeMovie(603);
      expect(api.sent[0]?.headers).not.toHaveProperty("authorization");
    });

    it("asks again for every request", async () => {
      // The whole reason this is a function. A token lives ten minutes and a
      // client is held for the life of a process; asking once would send an
      // expired token from then on.
      const tokens = ["first", "second"];
      const api = fakeApi(undefined, { auth: () => tokens.shift() });
      api.reply(200, { movie: { id: 1 } });
      api.reply(200, { movie: { id: 2 } });
      await new MetadataApi(api.clients).describeMovie(1);
      await new MetadataApi(api.clients).describeMovie(2);
      expect(api.sent.map((r) => r.headers.authorization)).toEqual([
        "Bearer first",
        "Bearer second",
      ]);
    });

    it("accepts a provider that has to go and get one", async () => {
      const api = fakeApi(undefined, {
        auth: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return "fetched";
        },
      });
      api.reply(200, { movie: { id: 603 } });
      await new MetadataApi(api.clients).describeMovie(603);
      expect(api.sent[0]?.headers).toMatchObject({
        authorization: "Bearer fetched",
      });
    });

    it("does not charge the call for the time the provider took", async () => {
      // A provider that refreshes makes a request of its own; counting it
      // here would blame this call for someone else's round trip.
      const api = fakeApi(undefined, {
        auth: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return "slow";
        },
      });
      api.reply(200, { movie: { id: 603 } });
      await new MetadataApi(api.clients).describeMovie(603);
      expect(api.observed[0]?.durationSeconds).toBeLessThan(0.05);
    });

    it("sends the caller's name with or without a token", async () => {
      const api = fakeApi(undefined, { auth: () => "a-token" });
      api.reply(200, { movie: { id: 603 } });
      await new MetadataApi(api.clients).describeMovie(603);
      expect(api.sent[0]?.headers).toMatchObject({
        "x-olympus-client": "test-agent",
      });
    });
  });

  it("uses each API's own client", async () => {
    const api = fakeApi();
    api.reply(200, { notificationId: "n-1" });
    await new NotificationApi(api.clients).sendNotification({
      notificationType: "system_test",
    } as never);
    expect(api.observed[0]).toMatchObject({
      api: "olympus",
      operation: "SendNotification",
      method: "POST",
    });
  });

  it("throws on an error answer and records its status", async () => {
    const api = fakeApi();
    api.reply(503);
    await expect(new MetadataApi(api.clients).describeMovie(1)).rejects.toThrow(
      "503",
    );
    expect(api.observed[0]).toMatchObject({
      operation: "DescribeMovie",
      statusCode: 503,
    });
  });

  it("throws on 404 unless the method declares undefined", async () => {
    const api = fakeApi();
    api.reply(404);
    api.reply(404);
    await expect(new MetadataApi(api.clients).describeMovie(1)).rejects.toThrow(
      "404",
    );
    await expect(
      new JobApi(api.clients).describeMetadataFetchJob("1", "movies"),
    ).resolves.toBeUndefined();
    expect(api.observed.map((o) => [o.operation, o.statusCode])).toEqual([
      ["DescribeMovie", 404],
      ["DescribeMetadataFetchJob", 404],
    ]);
  });

  it("records a request that got no response", async () => {
    const api = fakeApi();
    api.fail("connect ECONNREFUSED");
    await expect(new MetadataApi(api.clients).describeMovie(1)).rejects.toThrow(
      "ECONNREFUSED",
    );
    expect(api.observed[0]).toMatchObject({
      operation: "DescribeMovie",
      statusCode: undefined,
    });
  });

  it("rejects a client name the servers would not accept", () => {
    expect(() =>
      createOlympusClients({ baseUrl: "http://x/v1", clientName: "My Agent" }),
    ).toThrow('Invalid client name "My Agent"');
  });

  it("works without metrics (browsers)", async () => {
    const clients = createOlympusClients({
      baseUrl: "/api/v1",
      clientName: "olympus-site",
      axios: {
        adapter: async (config: { headers: Record<string, unknown> }) => ({
          data: {
            movie: { id: 1, sentBy: config.headers["x-olympus-client"] },
          },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        }),
      },
    });
    await expect(new MetadataApi(clients).describeMovie(1)).resolves.toEqual({
      id: 1,
      sentBy: "olympus-site",
    });
  });
});
