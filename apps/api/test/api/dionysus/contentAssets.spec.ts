import speakeasy from "speakeasy";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ASSET_ID,
  contentAuthKeys,
  contentAuthToken,
  graphQlContentAsset,
  OTP_SECRET,
} from "../../fixtures/content";
import { aggregate } from "../../fixtures/dionysus";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const CURTAIN = 'asset_tags: {tag: {type: {_eq: "system"}';
const authCookie = async () =>
  `x-dionysus-content-auth=${await contentAuthToken()}`;

describe("Dionysus content assets API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => {
    t.reset();
    t.graphql.on("FetchContentAuthKey", (variables) => ({
      dionysus_content_auth_by_pk: {
        key: contentAuthKeys[variables?.keyId as string],
        key_id: variables?.keyId,
        createdTime: "2026-01-01T00:00:00Z",
      },
    }));
  });

  describe("black curtain", () => {
    describe("GET /v1/dionysus/content/asset/:assetId (GetContentAsset)", () => {
      beforeEach(() => {
        t.graphql.on("GetContentAsset", {
          dionysus_content_assets: [graphQlContentAsset()],
        });
      });
      const document = () => t.graphql.calls("GetContentAsset")[0].document;

      it("applies the curtain to an unauthenticated request", async () => {
        const res = await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.asset.id).toBe(ASSET_ID);
        expect(document()).toContain(`content_id: {_eq: "${ASSET_ID}"}`);
        expect(document()).toContain(CURTAIN);
      });

      it("ignores a request to drop the curtain without auth", async () => {
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}`)
          .set("x-dionysus-content-bc", "false")
          .expect(200);

        expect(document()).toContain(CURTAIN);
      });

      it("lifts the curtain for a valid auth cookie", async () => {
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}`)
          .set("Cookie", await authCookie())
          .expect(200);

        expect(document()).not.toContain(CURTAIN);
      });

      it.each([
        ["a forged cookie", () => contentAuthToken({ key: "wrong-key" })],
        ["an expired cookie", () => contentAuthToken({ expires: "-1m" })],
        ["another issuer's cookie", () => contentAuthToken({ issuer: "evil" })],
      ])("keeps the curtain for %s", async (_, token) => {
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}`)
          .set("Cookie", `x-dionysus-content-auth=${await token()}`)
          .expect(200);

        expect(document()).toContain(CURTAIN);
      });

      it("returns 404 when the asset is missing or hidden", async () => {
        t.graphql.on("GetContentAsset", { dionysus_content_assets: [] });

        await t.http().get("/v1/dionysus/content/asset/missing").expect(404);
      });
    });

    describe("GET /v1/dionysus/content/assets (ListContentAssets)", () => {
      beforeEach(() => {
        t.graphql.on("ListContentAssets", {
          dionysus_content_assets: [graphQlContentAsset()],
          dionysus_content_assets_aggregate: aggregate(1),
        });
      });
      const document = () => t.graphql.calls("ListContentAssets")[0].document;

      it("applies the curtain to an unfiltered, unauthenticated list", async () => {
        const res = await t.http().get("/v1/dionysus/content/assets");

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(document()).toContain(CURTAIN);
        expect(document()).toContain("order_by: [{createdTime: desc}]");
      });

      it("combines the curtain with the caller's filters", async () => {
        await t
          .http()
          .get("/v1/dionysus/content/assets")
          .query({
            filters: base64Json({ type: "gt", name: "rating", value: 3 }),
            sortBy: "rating",
          })
          .expect(200);

        expect(document()).toContain(CURTAIN);
        expect(document()).toContain("{rating: {_gt: 3}}");
        expect(document()).toContain(
          "order_by: [{rating: desc}, {createdTime: desc}]",
        );
      });

      it("ignores a request to drop the curtain without auth", async () => {
        await t
          .http()
          .get("/v1/dionysus/content/assets")
          .set("x-dionysus-content-bc", "false")
          .expect(200);

        expect(document()).toContain(CURTAIN);
      });

      it("lists everything for an authenticated request", async () => {
        await t
          .http()
          .get("/v1/dionysus/content/assets")
          .set("Cookie", await authCookie())
          .expect(200);

        expect(document()).not.toContain("where:");
      });
    });

    describe("GET /v1/dionysus/content/assets/untagged (GetUntaggedContentAsset)", () => {
      it("requires authentication, whatever the curtain header says", async () => {
        await t.http().get("/v1/dionysus/content/assets/untagged").expect(401);
        await t
          .http()
          .get("/v1/dionysus/content/assets/untagged")
          .set("x-dionysus-content-bc", "false")
          .expect(401);
      });

      it("counts assets with only system tags as untagged", async () => {
        t.graphql.on("GetUntaggedContentAsset", {
          dionysus_content_assets: [graphQlContentAsset()],
          tagged: aggregate(1),
          untagged: aggregate(1),
        });

        await t
          .http()
          .get("/v1/dionysus/content/assets/untagged")
          .set("Cookie", await authCookie())
          .expect(200);

        const doc = t.graphql
          .calls("GetUntaggedContentAsset")[0]
          .document.replace(/\s+/g, " ");
        // untagged: no non-system tag at all; tagged: at least one.
        expect(
          doc.match(
            /_not: \{ asset_tags_aggregate: \{ count: \{ predicate: \{ _gt: 0 \}/g,
          ),
        ).toHaveLength(2);
        expect(doc).toContain("predicate: { _gte: 1 }");
      });

      it("returns the next untagged asset with counts", async () => {
        t.graphql.on("GetUntaggedContentAsset", {
          dionysus_content_assets: [graphQlContentAsset()],
          tagged: aggregate(90),
          untagged: aggregate(10),
        });

        const res = await t
          .http()
          .get("/v1/dionysus/content/assets/untagged")
          .set("Cookie", await authCookie());

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          asset: { id: ASSET_ID },
          tagged: 90,
          untagged: 10,
        });
      });

      it("returns 404 when everything is tagged", async () => {
        t.graphql.on("GetUntaggedContentAsset", {
          dionysus_content_assets: [],
          tagged: aggregate(90),
          untagged: aggregate(0),
        });

        await t
          .http()
          .get("/v1/dionysus/content/assets/untagged")
          .set("Cookie", await authCookie())
          .expect(404);
      });
    });

    describe("GET /v1/dionysus/content/asset/:assetId/similar (ListSimilarContentAssets)", () => {
      beforeEach(() => {
        t.graphql.on("ListSimilarContentAssets", {
          dionysus_content_assets: [
            graphQlContentAsset({ content_id: "other" }),
          ],
        });
      });
      const call = () => t.graphql.calls("ListSimilarContentAssets")[0];

      it("finds assets sharing the tags, excluding the asset itself", async () => {
        const res = await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}/similar`)
          .query({ tagType: "user,source", tagName: "beach,gopro" });

        expect(res.status).toBe(200);
        expect(res.body.assets).toHaveLength(1);
        expect(call().variables).toEqual({ content_id: ASSET_ID });
        expect(call().document).toContain(
          '{ name: { _ilike: "beach" }, type: { _eq: "user" } }',
        );
        expect(call().document).toContain(
          '{ name: { _ilike: "gopro" }, type: { _eq: "source" } }',
        );
        expect(call().document).toContain("bcCompliant");
      });

      it("drops the curtain for an authenticated request only", async () => {
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}/similar`)
          .query({ tagType: "user", tagName: "beach" })
          .set("x-dionysus-content-bc", "false")
          .expect(200);
        expect(call().document).toContain("bcCompliant");

        t.graphql.request.mockClear();
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}/similar`)
          .query({ tagType: "user", tagName: "beach" })
          .set("Cookie", await authCookie())
          .expect(200);
        expect(call().document).not.toContain("bcCompliant");
      });

      it("escapes tag names and types", async () => {
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}/similar`)
          .query({ tagType: 'user" } } } } ] x: [ {', tagName: "a" })
          .expect(200);

        expect(call().document).toContain('_eq: "user\\" } } } } ] x: [ {"');
      });

      it.each([
        ["no tags", {}],
        ["mismatched tag lists", { tagType: "user", tagName: "a,b" }],
      ])("rejects %s", async (_, query) => {
        await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}/similar`)
          .query(query)
          .expect(400);
      });
    });
  });

  describe("content auth", () => {
    describe("GET /v1/dionysus/content/auth/verify (VerifyAuthCode)", () => {
      it("exchanges a valid one-time code for an auth cookie", async () => {
        const otp = speakeasy.totp({ secret: OTP_SECRET, encoding: "base32" });

        const res = await t
          .http()
          .get("/v1/dionysus/content/auth/verify")
          .query({ otp });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ authorized: true });
        const cookie = String(res.headers["set-cookie"]);
        expect(cookie).toContain("x-dionysus-content-auth=");
        expect(cookie).toContain("SameSite=Strict");
        expect(cookie).toContain("Secure");
      });

      it("rejects a wrong code", async () => {
        await t
          .http()
          .get("/v1/dionysus/content/auth/verify")
          .query({ otp: "000000" })
          .expect(401);
      });
    });

    describe("GET /v1/dionysus/content/auth/status (CheckAuthorization)", () => {
      beforeEach(() => {
        t.graphql.on("CheckAuthorization", {
          dionysus_content_auth_by_pk: { key: contentAuthKeys["jwt.key"] },
        });
      });

      it("reports a valid cookie as authorized", async () => {
        const res = await t
          .http()
          .get("/v1/dionysus/content/auth/status")
          .set("Cookie", await authCookie());

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ authorized: true });
      });

      it.each([
        ["no cookie", undefined],
        ["a forged cookie", () => contentAuthToken({ key: "wrong" })],
      ])("answers 401 for %s", async (_, token) => {
        const req = t.http().get("/v1/dionysus/content/auth/status");
        if (token)
          req.set("Cookie", `x-dionysus-content-auth=${await token()}`);

        const res = await req;

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ authorized: false });
      });
    });

    describe("GET /v1/dionysus/content/auth/secret (GenerateAuthKey)", () => {
      it("generates a new base32 secret without storing it", async () => {
        const res = await t.http().get("/v1/dionysus/content/auth/secret");

        expect(res.status).toBe(200);
        expect(res.body.base32).toMatch(/^[A-Z2-7]+$/);
        expect(t.graphql.request).not.toHaveBeenCalled();
      });
    });
  });

  describe("assets", () => {
    describe("POST /v1/dionysus/content/assets (CreateContentAsset)", () => {
      it("stores the asset and returns 201", async () => {
        t.graphql.on("CreateContentAsset", {
          insert_dionysus_content_assets_one: graphQlContentAsset(),
        });

        const res = await t
          .http()
          .post("/v1/dionysus/content/assets")
          .send({
            asset: {
              id: ASSET_ID,
              newSha: "new-sha",
              newSizeBytes: 1_000_000,
              durationMs: 60_000,
              height: 1080,
              width: 1920,
              originalName: "clip.mov",
              originalSha: "orig-sha",
              originalSizeBytes: 2_000_000,
            },
          });

        expect(res.status).toBe(201);
        expect(t.graphql.calls("CreateContentAsset")[0].variables).toEqual({
          asset_sha: "new-sha",
          asset_size: 1_000_000,
          content_id: ASSET_ID,
          duration: 60_000,
          height: 1080,
          original_name: "clip.mov",
          original_sha: "orig-sha",
          original_size: 2_000_000,
          width: 1920,
        });
      });
    });

    describe("POST /v1/dionysus/content/asset/:assetId/jobs (CreateContentJob)", () => {
      it("publishes the job for the asset", async () => {
        await t
          .http()
          .post(`/v1/dionysus/content/asset/${ASSET_ID}/jobs`)
          .send({ type: "thumbnails" })
          .expect(200);

        expect(t.amqp.publish).toHaveBeenCalledWith(
          "content.trigger",
          "jobType.thumbnails",
          { assetId: ASSET_ID },
        );
      });
    });

    describe("PUT /v1/dionysus/content/asset/:assetId/rating (SetContentAssetRating)", () => {
      it("sets the rating", async () => {
        t.graphql.on("SetContentAssetRating", {
          update_dionysus_content_assets_by_pk: { content_id: ASSET_ID },
        });

        await t
          .http()
          .put(`/v1/dionysus/content/asset/${ASSET_ID}/rating`)
          .send({ rating: 5 })
          .expect(200);

        expect(t.graphql.calls("SetContentAssetRating")[0].variables).toEqual({
          content_id: ASSET_ID,
          rating: 5,
        });
      });
    });

    describe("GET /v1/dionysus/content/assets/duplicates (ListDuplicateContentAssets)", () => {
      it("finds assets by either digest", async () => {
        t.graphql.on("ListDuplicateContentAssets", {
          dionysus_content_assets: [graphQlContentAsset()],
        });

        const res = await t
          .http()
          .get("/v1/dionysus/content/assets/duplicates?digest=orig-sha");

        expect(res.status).toBe(200);
        expect(res.body.assets).toHaveLength(1);
        expect(
          t.graphql.calls("ListDuplicateContentAssets")[0].variables,
        ).toEqual({ sha: "orig-sha" });
      });
    });
  });

  describe("statistics", () => {
    it("GET .../statistics/aggregate (GetContentAssetAggregateStatistics)", async () => {
      t.graphql.on("GetContentAssetAggregateStatistics", {
        dionysus_content_assets_aggregate: {
          aggregate: {
            count: 3,
            avg: { asset_size: 20, duration: 200 },
            max: { asset_size: 30, duration: 300 },
            min: { asset_size: 10, duration: 100 },
            sum: { asset_size: 60, duration: 600 },
          },
        },
      });

      const res = await t
        .http()
        .get("/v1/dionysus/content/assets/statistics/aggregate");

      expect(res.status).toBe(200);
      const doc = () =>
        t.graphql.calls("GetContentAssetAggregateStatistics").at(-1)!.document;
      expect(doc()).toContain("dionysus_content_assets_aggregate(where:");
      expect(doc()).toContain(CURTAIN);
      await t
        .http()
        .get("/v1/dionysus/content/assets/statistics/aggregate")
        .set("Cookie", await authCookie())
        .expect(200);
      expect(doc()).toContain("dionysus_content_assets_aggregate {");
      expect(res.body).toEqual({
        count: 3,
        minSize: 10,
        maxSize: 30,
        avgSize: 20,
        totalSize: 60,
        minDuration: 100,
        maxDuration: 300,
        avgDuration: 200,
        totalDuration: 600,
      });
    });

    it.each([
      [
        "duration",
        "GetContentAssetDurationStatistics",
        "dionysus_content_asset_duration_statistics",
        5,
        "5m",
      ],
      [
        "size",
        "GetContentAssetSizeStatistics",
        "dionysus_content_asset_size_statistics",
        1_500_000,
        "1.5 MB",
      ],
      [
        "height",
        "GetContentAssetHeightStatistics",
        "dionysus_content_asset_height_statistics",
        1080,
        "1080",
      ],
      [
        "width",
        "GetContentAssetWidthStatistics",
        "dionysus_content_asset_width_statistics",
        1920,
        "1920",
      ],
    ])(
      "GET .../statistics/%s (%s)",
      async (path, operation, root, bucket, label) => {
        t.graphql.on(operation, {
          [root]: [{ bucket, bucket_width: 1, count: 7 }],
        });

        const res = await t
          .http()
          .get(`/v1/dionysus/content/assets/statistics/${path}`);

        expect(res.status).toBe(200);
        expect(res.body.categories[0]).toContain(label);
        expect(res.body.series[0].data).toEqual([7]);
      },
    );
  });
});
