import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  ASSET_ID,
  CATEGORY_ID,
  CHANNEL_ID,
  graphQlChannel,
  graphQlChannelCategory,
  graphQlContentTag,
  TAG_ID,
} from "../../fixtures/content";
import { aggregate } from "../../fixtures/dionysus";
import { base64Json } from "../../fixtures/olympus";
import { createTestApp, type TestApp } from "../../support/testApp";

const CHANNEL = `/v1/dionysus/content/channel/${CHANNEL_ID}`;
const beachFilter = { type: "eq", name: "name", value: "beach" };
const candidates = {
  dionysus_content_assets: [
    { content_id: ASSET_ID, width: 1920, height: 1080 },
  ],
  dionysus_content_assets_aggregate: aggregate(12),
};

describe("Dionysus content channels and tags API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => {
    t.reset();
    vi.restoreAllMocks();
  });

  describe("channels", () => {
    describe("POST /v1/dionysus/content/channels (CreateContentAssetChannel)", () => {
      it("stores the channel with its first page of assets cached", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        t.graphql.on("ListContentAssetChannelCandidates", candidates);
        t.graphql.on("CreateContentAssetChannel", {
          insert_dionysus_content_asset_channel_one: graphQlChannel(),
        });

        const res = await t
          .http()
          .post("/v1/dionysus/content/channels")
          .send({
            channel: {
              name: "Beaches",
              description: "Sand and sea",
              bcCompliant: true,
              categoryId: CATEGORY_ID,
              filterInput: "beach",
              filterDefinition: beachFilter,
            },
          });

        expect(res.status).toBe(201);
        expect(res.body.channel.id).toBe(CHANNEL_ID);
        expect(
          t.graphql.calls("ListContentAssetChannelCandidates")[0].document,
        ).toContain(
          'limit: 9, offset: 0, order_by: [{createdTime: desc}], where: {name: {_eq: "beach"}}',
        );
        expect(
          t.graphql.calls("CreateContentAssetChannel")[0].variables,
        ).toMatchObject({
          name: "Beaches",
          categoryId: CATEGORY_ID,
          encodedFilter: base64Json(beachFilter),
          ttl: 7,
          jitter: 240,
          assetCount: 12,
          assetCache: [
            {
              channel_id: undefined,
              assetId: ASSET_ID,
              width: 1920,
              height: 1080,
            },
          ],
        });
      });
    });

    describe("GET /v1/dionysus/content/channel/:channelId (DescribeContentAssetChannel)", () => {
      it("returns the channel", async () => {
        t.graphql.on("DescribeContentAssetChannel", {
          dionysus_content_asset_channel_by_pk: graphQlChannel(),
        });

        const res = await t.http().get(CHANNEL);

        expect(res.status).toBe(200);
        expect(res.body.channel).toMatchObject({
          id: CHANNEL_ID,
          name: "Beaches",
        });
      });

      it("returns 404 for an unknown channel", async () => {
        t.graphql.on("DescribeContentAssetChannel", {
          dionysus_content_asset_channel_by_pk: null,
        });

        await t.http().get("/v1/dionysus/content/channel/missing").expect(404);
      });
    });

    describe("PUT /v1/dionysus/content/channel/:channelId (UpdateContentAssetChannel)", () => {
      const body = {
        channel: {
          name: "Beaches",
          description: "Sand",
          bcCompliant: true,
          filterInput: "beach",
          filterDefinition: beachFilter,
        },
      };

      it("rebuilds the channel's cache", async () => {
        t.graphql.on("GetContentAssetChannelFilter", {
          dionysus_content_asset_channel_by_pk: { encodedFilter: "x" },
        });
        t.graphql.on("DeleteContentAssetChannelCache", {
          delete_dionysus_content_asset_channel_cache: { affected_rows: 9 },
        });
        t.graphql.on("ListContentAssetChannelCandidates", candidates);
        t.graphql.on("UpdateContentAssetChannel", {
          insert_dionysus_content_asset_channel_cache: { affected_rows: 1 },
          update_dionysus_content_asset_channel_by_pk: graphQlChannel(),
        });

        await t.http().put(CHANNEL).send(body).expect(200);

        expect(
          t.graphql.calls("DeleteContentAssetChannelCache")[0].variables,
        ).toEqual({ channelId: CHANNEL_ID });
        expect(
          t.graphql.calls("UpdateContentAssetChannel")[0].variables,
        ).toMatchObject({
          channelId: CHANNEL_ID,
          assetCache: [{ channel_id: CHANNEL_ID, assetId: ASSET_ID }],
        });
      });

      it("returns 404 without touching the cache of an unknown channel", async () => {
        t.graphql.on("GetContentAssetChannelFilter", {
          dionysus_content_asset_channel_by_pk: null,
        });

        await t
          .http()
          .put("/v1/dionysus/content/channel/missing")
          .send(body)
          .expect(404);

        expect(t.graphql.calls("DeleteContentAssetChannelCache")).toHaveLength(
          0,
        );
      });
    });

    describe("POST /v1/dionysus/content/channel/:channelId/refresh (RefreshContentAssetChannel)", () => {
      it("rebuilds the cache from the stored filter", async () => {
        t.graphql.on("GetContentAssetChannelFilter", {
          dionysus_content_asset_channel_by_pk: {
            encodedFilter: base64Json(beachFilter),
          },
        });
        t.graphql.on("ListContentAssetChannelCandidates", candidates);
        t.graphql.on("DeleteContentAssetChannelCache", {
          delete_dionysus_content_asset_channel_cache: { affected_rows: 9 },
        });
        t.graphql.on("UpdateContentAssetChannelCache", {
          insert_dionysus_content_asset_channel_cache: { affected_rows: 1 },
          update_dionysus_content_asset_channel_by_pk: graphQlChannel(),
        });

        await t.http().post(`${CHANNEL}/refresh`).expect(200);

        expect(
          t.graphql.calls("ListContentAssetChannelCandidates")[0].document,
        ).toContain('where: {name: {_eq: "beach"}}');
        expect(
          t.graphql.calls("UpdateContentAssetChannelCache")[0].variables,
        ).toMatchObject({ channelId: CHANNEL_ID, assetCount: 12 });
      });

      it("returns 404 for an unknown channel", async () => {
        t.graphql.on("GetContentAssetChannelFilter", {
          dionysus_content_asset_channel_by_pk: null,
        });

        await t
          .http()
          .post("/v1/dionysus/content/channel/missing/refresh")
          .expect(404);
      });
    });

    describe("PUT .../favorite (FavoriteContentAssetChannel)", () => {
      it("sets the favorite flag", async () => {
        t.graphql.on("FavoriteContentAssetChannel", {
          update_dionysus_content_asset_channel_by_pk: graphQlChannel({
            favorite: true,
          }),
        });

        const res = await t
          .http()
          .put(`${CHANNEL}/favorite`)
          .send({ favorite: true });

        expect(res.status).toBe(200);
        expect(res.body.channel.favorite).toBe(true);
        expect(
          t.graphql.calls("FavoriteContentAssetChannel")[0].variables,
        ).toEqual({ channelId: CHANNEL_ID, favorite: true });
      });

      it("returns 404 for an unknown channel", async () => {
        t.graphql.on("FavoriteContentAssetChannel", {
          update_dionysus_content_asset_channel_by_pk: null,
        });

        await t
          .http()
          .put("/v1/dionysus/content/channel/missing/favorite")
          .send({ favorite: true })
          .expect(404);
      });
    });

    describe("DELETE /v1/dionysus/content/channel/:channelId (DeleteContentAssetChannel)", () => {
      it("deletes the cache, then the channel, and answers 410", async () => {
        t.graphql.on("DeleteContentAssetChannel", {
          delete_dionysus_content_asset_channel_cache: { affected_rows: 9 },
          delete_dionysus_content_asset_channel_by_pk: { id: CHANNEL_ID },
        });

        await t.http().delete(CHANNEL).expect(410);

        const { document } = t.graphql.calls("DeleteContentAssetChannel")[0];
        expect(document.indexOf("_channel_cache(")).toBeLessThan(
          document.indexOf("_channel_by_pk("),
        );
      });

      it("returns 404 for an unknown channel", async () => {
        t.graphql.on("DeleteContentAssetChannel", {
          delete_dionysus_content_asset_channel_cache: { affected_rows: 0 },
          delete_dionysus_content_asset_channel_by_pk: null,
        });

        await t
          .http()
          .delete("/v1/dionysus/content/channel/missing")
          .expect(404);
      });
    });

    describe("GET /v1/dionysus/content/channels (ListContentAssetChannels)", () => {
      it("returns a page of channels", async () => {
        t.graphql.on("ListContentAssetChannels", {
          dionysus_content_asset_channel: [graphQlChannel()],
          dionysus_content_asset_channel_aggregate: aggregate(1),
        });

        const res = await t
          .http()
          .get("/v1/dionysus/content/channels")
          .query({
            filters: base64Json({ type: "eq", name: "favorite", value: true }),
          });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(
          t.graphql.calls("ListContentAssetChannels")[0].document,
        ).toContain("where: {favorite: {_eq: true}}");
      });
    });
  });

  describe("channel categories", () => {
    describe("POST /v1/dionysus/content/channels/categories (CreateContentAssetChannelCategory)", () => {
      it("creates the category", async () => {
        t.graphql.on("CreateContentAssetChannelCategory", {
          insert_dionysus_content_asset_channel_category_one:
            graphQlChannelCategory(),
        });

        const res = await t
          .http()
          .post("/v1/dionysus/content/channels/categories")
          .send({ category: { name: "Travel" } });

        expect(res.status).toBe(201);
        expect(res.body.category).toMatchObject({
          id: CATEGORY_ID,
          name: "Travel",
        });
      });
    });

    describe("GET /v1/dionysus/content/channel/category/:categoryId (DescribeContentAssetChannelCategory)", () => {
      it("returns the category", async () => {
        t.graphql.on("DescribeContentAssetChannelCategory", {
          dionysus_content_asset_channel_category_by_pk:
            graphQlChannelCategory(),
        });

        await t
          .http()
          .get(`/v1/dionysus/content/channel/category/${CATEGORY_ID}`)
          .expect(200);
      });

      it("returns 404 for an unknown category", async () => {
        t.graphql.on("DescribeContentAssetChannelCategory", {
          dionysus_content_asset_channel_category_by_pk: null,
        });

        await t
          .http()
          .get("/v1/dionysus/content/channel/category/missing")
          .expect(404);
      });
    });

    describe("PUT /v1/dionysus/content/channels/category/:categoryId (UpdateContentAssetChannelCategory)", () => {
      it("renames the category", async () => {
        t.graphql.on("UpdateContentAssetChannelCategory", {
          update_dionysus_content_asset_channel_category_by_pk:
            graphQlChannelCategory({ name: "Trips" }),
        });

        const res = await t
          .http()
          .put(`/v1/dionysus/content/channels/category/${CATEGORY_ID}`)
          .send({ category: { name: "Trips" } });

        expect(res.status).toBe(200);
        expect(res.body.category.name).toBe("Trips");
      });

      it("returns 404 for an unknown category", async () => {
        t.graphql.on("UpdateContentAssetChannelCategory", {
          update_dionysus_content_asset_channel_category_by_pk: null,
        });

        await t
          .http()
          .put("/v1/dionysus/content/channels/category/missing")
          .send({ category: { name: "x" } })
          .expect(404);
      });
    });

    describe("GET /v1/dionysus/content/channels/categories (ListContentAssetChannelCategories)", () => {
      it("returns a page of categories", async () => {
        t.graphql.on("ListContentAssetChannelCategories", {
          dionysus_content_asset_channel_category: [graphQlChannelCategory()],
          dionysus_content_asset_channel_category_aggregate: aggregate(4),
        });

        const res = await t
          .http()
          .get("/v1/dionysus/content/channels/categories");

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(4);
      });
    });

    describe("GET .../category/:categoryId/channels (ListContentAssetChannelsForCategory)", () => {
      it("returns the category's channels", async () => {
        t.graphql.on("ListContentAssetChannelsForCategory", {
          dionysus_content_asset_channel_category_by_pk: {
            channels: [graphQlChannel()],
            channels_aggregate: aggregate(1),
          },
        });

        const res = await t
          .http()
          .get(
            `/v1/dionysus/content/channels/category/${CATEGORY_ID}/channels`,
          );

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          count: 1,
          channels: [{ id: CHANNEL_ID }],
        });
      });

      it("returns 404 for an unknown category", async () => {
        t.graphql.on("ListContentAssetChannelsForCategory", {
          dionysus_content_asset_channel_category_by_pk: null,
        });

        await t
          .http()
          .get("/v1/dionysus/content/channels/category/missing/channels")
          .expect(404);
      });
    });
  });

  describe("tags", () => {
    describe("PUT /v1/dionysus/content/asset/:assetId/tags (AddContentAssetTagToAsset)", () => {
      const tag = { tag: { name: "beach", type: "user" } };

      it("tags the asset with an existing tag", async () => {
        t.graphql.on("FindContentAssetTag", {
          dionysus_content_tags: [{ content_tag_id: TAG_ID }],
        });
        t.graphql.on("TagAssetOrIgnoreOnConflict", {
          insert_dionysus_content_asset_tags: { affected_rows: 1 },
        });

        await t
          .http()
          .put(`/v1/dionysus/content/asset/${ASSET_ID}/tags`)
          .send(tag)
          .expect(200);

        expect(
          t.graphql.calls("TagAssetOrIgnoreOnConflict")[0].variables,
        ).toEqual({ content_id: ASSET_ID, content_tag_id: TAG_ID });
      });

      it("answers 304 when the asset already has the tag", async () => {
        t.graphql.on("FindContentAssetTag", {
          dionysus_content_tags: [{ content_tag_id: TAG_ID }],
        });
        t.graphql.on("TagAssetOrIgnoreOnConflict", {
          insert_dionysus_content_asset_tags: { affected_rows: 0 },
        });

        await t
          .http()
          .put(`/v1/dionysus/content/asset/${ASSET_ID}/tags`)
          .send(tag)
          .expect(304);
      });

      it("creates a new tag on the asset", async () => {
        t.graphql.on("FindContentAssetTag", { dionysus_content_tags: [] });
        t.graphql.on("CreateTagAndUpdateAsset", {
          insert_dionysus_content_tags: {
            returning: [{ content_tag_id: TAG_ID }],
          },
        });

        await t
          .http()
          .put(`/v1/dionysus/content/asset/${ASSET_ID}/tags`)
          .send(tag)
          .expect(200);

        expect(t.graphql.calls("CreateTagAndUpdateAsset")[0].variables).toEqual(
          {
            content_id: ASSET_ID,
            name: "beach",
            type: "user",
          },
        );
      });
    });

    describe("POST /v1/dionysus/content/assetTags (CreateContentAssetTag)", () => {
      it("creates the tag", async () => {
        t.graphql.on("CreateTag", {
          insert_dionysus_content_tags_one: graphQlContentTag(),
        });

        const res = await t
          .http()
          .post("/v1/dionysus/content/assetTags")
          .send({ tag: { name: "beach", type: "user" } });

        expect(res.status).toBe(201);
        expect(res.body.tag).toMatchObject({ id: TAG_ID, name: "beach" });
      });

      it("answers 409 for an existing tag", async () => {
        t.graphql.on("CreateTag", { insert_dionysus_content_tags_one: null });

        await t
          .http()
          .post("/v1/dionysus/content/assetTags")
          .send({ tag: { name: "beach", type: "user" } })
          .expect(409);
      });
    });

    describe("DELETE /v1/dionysus/content/asset/:assetId/tag/:tagId (DeleteContentAssetTagFromAsset)", () => {
      it("removes the tag from the asset", async () => {
        t.graphql.on("RemoveContentAssetTag", {
          delete_dionysus_content_asset_tags: { affected_rows: 1 },
        });

        await t
          .http()
          .delete(`/v1/dionysus/content/asset/${ASSET_ID}/tag/${TAG_ID}`)
          .expect(410);

        expect(t.graphql.calls("RemoveContentAssetTag")[0].variables).toEqual({
          content_id: ASSET_ID,
          content_tag_id: TAG_ID,
        });
      });
    });

    describe("GET /v1/dionysus/content/assetTags (ListAvailableContentAssetTags)", () => {
      beforeEach(() => {
        t.graphql.on("ListContentAssetTags", {
          dionysus_content_tags: [graphQlContentTag()],
        });
      });
      const call = () => t.graphql.calls("ListContentAssetTags")[0];

      it("lists all tags", async () => {
        const res = await t.http().get("/v1/dionysus/content/assetTags");

        expect(res.status).toBe(200);
        expect(res.body.tags).toHaveLength(1);
        expect(call().document).not.toContain("where");
      });

      it("excludes the asset's tags and matches type and name", async () => {
        await t
          .http()
          .get("/v1/dionysus/content/assetTags")
          .query({ assetId: ASSET_ID, type: "user", name: "bea" })
          .expect(200);

        expect(call().variables).toEqual({
          contentId: ASSET_ID,
          type: "user",
          name: "%bea%",
        });
        expect(call().document).toContain("_not: { tagged_content");
      });
    });

    describe("GET /v1/dionysus/content/asset/:assetId/tags (ListContentAssetTagsForAsset)", () => {
      it("lists the asset's tags", async () => {
        t.graphql.on("ListContentAssetTagsForAsset", {
          dionysus_content_tags: [graphQlContentTag()],
        });

        const res = await t
          .http()
          .get(`/v1/dionysus/content/asset/${ASSET_ID}/tags`);

        expect(res.status).toBe(200);
        expect(res.body.tags[0].name).toBe("beach");
      });
    });
  });
});
