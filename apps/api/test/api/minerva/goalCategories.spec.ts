import { describe, expect, it } from "vitest";
import { STARTER_CATEGORIES } from "../../../src/minerva/goals/services/GoalCategoryService";
import { GOAL_CATEGORY_ID, graphQlGoalCategory } from "../../fixtures/minerva";
import {
  OTHER_USER,
  signedInApp,
  uniqueViolation,
  USER,
} from "../../support/signedInApp";

const SECOND_ID = "6a2d9e40-0000-4000-8000-000000000002";
const BASE = "/v1/minerva/goals";

/** The settings row: present once the starter categories were given. */
const seeded = { starterCategoriesTime: "2026-10-01T12:00:00Z" };

/**
 * The goal category operations over the real HTTP stack. Every one is the
 * caller's own: the user comes from the access token, and every Hasura
 * document is scoped by it.
 */
describe("Goal categories API", () => {
  const ctx = signedInApp();

  describe("without an identity", () => {
    it.each([
      ["get", `${BASE}/categories`],
      ["post", `${BASE}/categories`],
      ["put", `${BASE}/categories/order`],
      ["get", `${BASE}/category/${GOAL_CATEGORY_ID}`],
      ["put", `${BASE}/category/${GOAL_CATEGORY_ID}`],
      ["delete", `${BASE}/category/${GOAL_CATEGORY_ID}`],
    ] as const)(
      "%s %s answers 401 and asks Hasura nothing",
      async (method, path) => {
        const res = await ctx.t.http()[method](path);
        expect(res.status).toBe(401);
        expect(ctx.t.graphql.request).not.toHaveBeenCalled();
      },
    );
  });

  describe("ListGoalCategories", () => {
    it("lists the caller's categories in order", async () => {
      ctx.t.graphql.on("ListGoalCategories", {
        minerva_goal_categories: [
          graphQlGoalCategory(),
          graphQlGoalCategory({
            id: SECOND_ID,
            name: "Work",
            position: 1,
            archivedTime: "2026-10-02T08:00:00Z",
          }),
        ],
        minerva_goal_user_settings_by_pk: seeded,
      });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/categories`));

      expect(res.status).toBe(200);
      expect(
        res.body.goalCategories.map(
          (c: { name: string; archived: boolean }) => [c.name, c.archived],
        ),
      ).toEqual([
        ["Health", false],
        ["Work", true],
      ]);
      expect(ctx.t.graphql.calls("ListGoalCategories")[0].variables).toEqual({
        userId: USER,
      });
      expect(ctx.t.graphql.calls("GiveStarterGoalCategories")).toHaveLength(0);
    });

    it("gives a new user the starter categories, once", async () => {
      let reads = 0;
      ctx.t.graphql
        .on("ListGoalCategories", () => {
          reads += 1;
          return reads === 1
            ? {
                minerva_goal_categories: [],
                minerva_goal_user_settings_by_pk: null,
              }
            : {
                minerva_goal_categories: STARTER_CATEGORIES.map((c, i) =>
                  graphQlGoalCategory({
                    id: `6a2d9e40-0000-4000-8000-00000000001${i}`,
                    ...c,
                    vision: null,
                    position: i,
                  }),
                ),
                minerva_goal_user_settings_by_pk: seeded,
              };
        })
        .on("GiveStarterGoalCategories", {
          insert_minerva_goal_user_settings_one: { userId: USER },
          insert_minerva_goal_categories: { affected_rows: 6 },
        });

      const res = await ctx.as(ctx.t.http().get(`${BASE}/categories`));

      expect(res.status).toBe(200);
      expect(
        res.body.goalCategories.map((c: { name: string }) => c.name),
      ).toEqual([
        "Health",
        "Work",
        "Relationships",
        "Finance",
        "Learning",
        "Home",
      ]);
      const give = ctx.t.graphql.calls("GiveStarterGoalCategories")[0]
        .variables as {
        settings: { userId: string };
        objects: { userId: string; name: string; position: number }[];
      };
      expect(give.settings.userId).toBe(USER);
      expect(give.objects.map((o) => [o.name, o.position])).toEqual([
        ["Health", 0],
        ["Work", 1],
        ["Relationships", 2],
        ["Finance", 3],
        ["Learning", 4],
        ["Home", 5],
      ]);
      expect(give.objects.every((o) => o.userId === USER)).toBe(true);
    });

    it("gives nothing when a concurrent first read got there first", async () => {
      let reads = 0;
      ctx.t.graphql
        .on("ListGoalCategories", () => {
          reads += 1;
          return {
            minerva_goal_categories: reads === 1 ? [] : [graphQlGoalCategory()],
            minerva_goal_user_settings_by_pk: reads === 1 ? null : seeded,
          };
        })
        .on("GiveStarterGoalCategories", uniqueViolation);

      const res = await ctx.as(ctx.t.http().get(`${BASE}/categories`));

      expect(res.status).toBe(200);
      expect(res.body.goalCategories).toHaveLength(1);
      expect(reads).toBe(2);
    });

    it("skips starter names the user already has, after their categories", async () => {
      let reads = 0;
      ctx.t.graphql
        .on("ListGoalCategories", () => {
          reads += 1;
          return {
            minerva_goal_categories: [
              graphQlGoalCategory({ name: "health", position: 0 }),
            ],
            minerva_goal_user_settings_by_pk: reads === 1 ? null : seeded,
          };
        })
        .on("GiveStarterGoalCategories", {
          insert_minerva_goal_user_settings_one: { userId: USER },
          insert_minerva_goal_categories: { affected_rows: 5 },
        });

      await ctx.as(ctx.t.http().get(`${BASE}/categories`));

      const give = ctx.t.graphql.calls("GiveStarterGoalCategories")[0]
        .variables as { objects: { name: string; position: number }[] };
      expect(give.objects.map((o) => [o.name, o.position])).toEqual([
        ["Work", 1],
        ["Relationships", 2],
        ["Finance", 3],
        ["Learning", 4],
        ["Home", 5],
      ]);
    });
  });

  describe("DescribeGoalCategory", () => {
    it("returns the category, scoped to the caller", async () => {
      ctx.t.graphql.on("DescribeGoalCategory", {
        minerva_goal_categories: [graphQlGoalCategory()],
      });

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/category/${GOAL_CATEGORY_ID}`),
      );

      expect(res.status).toBe(200);
      expect(res.body.goalCategory).toMatchObject({
        id: GOAL_CATEGORY_ID,
        name: "Health",
        vision: "Strong enough to ride all day at 60.",
      });
      expect(ctx.t.graphql.calls("DescribeGoalCategory")[0].variables).toEqual({
        userId: USER,
        categoryId: GOAL_CATEGORY_ID,
      });
    });

    it("answers 404 for someone else's category", async () => {
      ctx.t.graphql.on("DescribeGoalCategory", { minerva_goal_categories: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().get(`${BASE}/category/${GOAL_CATEGORY_ID}`),
      );

      expect(res.status).toBe(404);
      expect(
        ctx.t.graphql.calls("DescribeGoalCategory")[0].variables,
      ).toMatchObject({ userId: OTHER_USER });
    });

    it("answers 400 for an id that is not a UUID, before Hasura", async () => {
      const res = await ctx.as(ctx.t.http().get(`${BASE}/category/nope`));

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("CreateGoalCategory", () => {
    const listed = () =>
      ctx.t.graphql.on("ListGoalCategories", {
        minerva_goal_categories: [
          graphQlGoalCategory(),
          graphQlGoalCategory({ id: SECOND_ID, name: "Work", position: 4 }),
        ],
        minerva_goal_user_settings_by_pk: seeded,
      });

    it("adds the category at the end, with a Location header", async () => {
      listed().on("CreateGoalCategory", {
        insert_minerva_goal_categories_one: graphQlGoalCategory({
          name: "Craft",
          position: 5,
        }),
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/categories`)
          .send({
            goalCategory: {
              name: " Craft ",
              color: "#FA541C",
              icon: "star",
              vision: "  Make one thing a month.  ",
            },
          }),
      );

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(
        `/v1/minerva/goals/category/${GOAL_CATEGORY_ID}`,
      );
      expect(ctx.t.graphql.calls("CreateGoalCategory")[0].variables).toEqual({
        object: {
          userId: USER,
          name: "Craft",
          color: "#fa541c",
          icon: "star",
          vision: "Make one thing a month.",
          position: 5,
        },
      });
    });

    it("answers 409 for a name the caller already has", async () => {
      listed().on("CreateGoalCategory", uniqueViolation);

      const res = await ctx.as(
        ctx.t
          .http()
          .post(`${BASE}/categories`)
          .send({
            goalCategory: { name: "HEALTH", color: "#52c41a", icon: "heart" },
          }),
      );

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "You already have a goal category named HEALTH",
      );
    });

    it.each([
      ["no body", undefined],
      ["no category", {}],
      [
        "a blank name",
        { goalCategory: { name: " ", color: "#52c41a", icon: "heart" } },
      ],
      ["no colour", { goalCategory: { name: "a", icon: "heart" } }],
      [
        "a colour that is not hex",
        { goalCategory: { name: "a", color: "green", icon: "heart" } },
      ],
      [
        "an unknown icon",
        { goalCategory: { name: "a", color: "#52c41a", icon: "rocket" } },
      ],
      [
        "a long vision",
        {
          goalCategory: {
            name: "a",
            color: "#52c41a",
            icon: "heart",
            vision: "x".repeat(2001),
          },
        },
      ],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await ctx.as(
        ctx.t.http().post(`${BASE}/categories`).send(body),
      );

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("UpdateGoalCategory", () => {
    const update = (body: object) =>
      ctx.as(
        ctx.t.http().put(`${BASE}/category/${GOAL_CATEGORY_ID}`).send(body),
      );

    it("changes only what differs", async () => {
      ctx.t.graphql
        .on("DescribeGoalCategory", {
          minerva_goal_categories: [graphQlGoalCategory()],
        })
        .on("UpdateGoalCategory", {
          update_minerva_goal_categories: {
            returning: [graphQlGoalCategory({ vision: "Ride every week." })],
          },
        });

      const res = await update({
        goalCategory: {
          name: "Health",
          color: "#52C41A",
          vision: "Ride every week.",
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.goalCategory.vision).toBe("Ride every week.");
      expect(ctx.t.graphql.calls("UpdateGoalCategory")[0].variables).toEqual({
        userId: USER,
        categoryId: GOAL_CATEGORY_ID,
        set: { vision: "Ride every week." },
      });
    });

    it("archives a category, and brings it back", async () => {
      ctx.t.graphql
        .on("DescribeGoalCategory", {
          minerva_goal_categories: [graphQlGoalCategory()],
        })
        .on("UpdateGoalCategory", {
          update_minerva_goal_categories: {
            returning: [
              graphQlGoalCategory({ archivedTime: "2026-10-02T08:00:00Z" }),
            ],
          },
        });

      const archive = await update({ goalCategory: { archived: true } });

      expect(archive.status).toBe(200);
      expect(archive.body.goalCategory.archived).toBe(true);
      const set = (
        ctx.t.graphql.calls("UpdateGoalCategory")[0].variables as {
          set: { archivedTime: string };
        }
      ).set;
      expect(Number.isNaN(Date.parse(set.archivedTime))).toBe(false);

      ctx.t.reset();
      ctx.t.graphql
        .on("DescribeGoalCategory", {
          minerva_goal_categories: [
            graphQlGoalCategory({ archivedTime: "2026-10-02T08:00:00Z" }),
          ],
        })
        .on("UpdateGoalCategory", {
          update_minerva_goal_categories: {
            returning: [graphQlGoalCategory()],
          },
        });

      const restore = await update({ goalCategory: { archived: false } });

      expect(restore.status).toBe(200);
      expect(
        ctx.t.graphql.calls("UpdateGoalCategory")[0].variables,
      ).toMatchObject({ set: { archivedTime: null } });
    });

    it("removes the vision with null", async () => {
      ctx.t.graphql
        .on("DescribeGoalCategory", {
          minerva_goal_categories: [graphQlGoalCategory()],
        })
        .on("UpdateGoalCategory", {
          update_minerva_goal_categories: {
            returning: [graphQlGoalCategory({ vision: null })],
          },
        });

      const res = await update({ goalCategory: { vision: null } });

      expect(res.status).toBe(200);
      expect(res.body.goalCategory.vision).toBeUndefined();
      expect(
        ctx.t.graphql.calls("UpdateGoalCategory")[0].variables,
      ).toMatchObject({ set: { vision: null } });
    });

    it("answers 304 for an empty change, and the category as is when nothing differs", async () => {
      ctx.t.graphql.on("DescribeGoalCategory", {
        minerva_goal_categories: [graphQlGoalCategory()],
      });

      expect((await update({ goalCategory: {} })).status).toBe(304);
      const same = await update({ goalCategory: { icon: "heart" } });
      expect(same.status).toBe(200);
      expect(same.body.goalCategory.name).toBe("Health");
      expect(ctx.t.graphql.calls("UpdateGoalCategory")).toHaveLength(0);
    });

    it("answers 409 when the new name is taken", async () => {
      ctx.t.graphql
        .on("DescribeGoalCategory", {
          minerva_goal_categories: [graphQlGoalCategory()],
        })
        .on("UpdateGoalCategory", uniqueViolation);

      const res = await update({ goalCategory: { name: "Work" } });

      expect(res.status).toBe(409);
    });

    it("answers 404 for someone else's category, writing nothing", async () => {
      ctx.t.graphql.on("DescribeGoalCategory", { minerva_goal_categories: [] });
      await ctx.signInAs(OTHER_USER);

      const res = await update({ goalCategory: { name: "Mine" } });

      expect(res.status).toBe(404);
      expect(ctx.t.graphql.calls("UpdateGoalCategory")).toHaveLength(0);
    });

    it.each([
      ["no category", {}],
      ["archived that is not a boolean", { goalCategory: { archived: "yes" } }],
      ["an unknown icon", { goalCategory: { icon: "rocket" } }],
    ])("answers 400 for %s, before Hasura", async (_, body) => {
      const res = await update(body);

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });

  describe("DeleteGoalCategory", () => {
    it("deletes the caller's category", async () => {
      ctx.t.graphql.on("DeleteGoalCategory", {
        delete_minerva_goal_categories: { affected_rows: 1 },
      });

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/category/${GOAL_CATEGORY_ID}`),
      );

      expect(res.status).toBe(204);
      expect(ctx.t.graphql.calls("DeleteGoalCategory")[0].variables).toEqual({
        userId: USER,
        categoryId: GOAL_CATEGORY_ID,
      });
    });

    it("answers 404 for someone else's category", async () => {
      ctx.t.graphql.on("DeleteGoalCategory", {
        delete_minerva_goal_categories: { affected_rows: 0 },
      });
      await ctx.signInAs(OTHER_USER);

      const res = await ctx.as(
        ctx.t.http().delete(`${BASE}/category/${GOAL_CATEGORY_ID}`),
      );

      expect(res.status).toBe(404);
    });
  });

  describe("ReorderGoalCategories", () => {
    const listed = () =>
      ctx.t.graphql.on("ListGoalCategories", {
        minerva_goal_categories: [
          graphQlGoalCategory(),
          graphQlGoalCategory({ id: SECOND_ID, name: "Work", position: 1 }),
        ],
        minerva_goal_user_settings_by_pk: seeded,
      });

    it("puts the categories in the order given", async () => {
      listed().on("ReorderGoalCategories", {
        update_minerva_goal_categories_many: [{ affected_rows: 1 }],
      });

      const res = await ctx.as(
        ctx.t
          .http()
          .put(`${BASE}/categories/order`)
          .send({ categoryIds: [SECOND_ID, GOAL_CATEGORY_ID] }),
      );

      expect(res.status).toBe(200);
      expect(ctx.t.graphql.calls("ReorderGoalCategories")[0].variables).toEqual(
        {
          updates: [
            {
              where: { id: { _eq: SECOND_ID }, userId: { _eq: USER } },
              _set: { position: 0 },
            },
            {
              where: { id: { _eq: GOAL_CATEGORY_ID }, userId: { _eq: USER } },
              _set: { position: 1 },
            },
          ],
        },
      );
    });

    it.each([
      ["a missing category", [SECOND_ID]],
      ["a repeated category", [SECOND_ID, SECOND_ID]],
      [
        "another user's category",
        [SECOND_ID, "6a2d9e40-0000-4000-8000-0000000000ff"],
      ],
    ])("answers 400 for %s, writing nothing", async (_, categoryIds) => {
      listed();

      const res = await ctx.as(
        ctx.t.http().put(`${BASE}/categories/order`).send({ categoryIds }),
      );

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.calls("ReorderGoalCategories")).toHaveLength(0);
    });

    it("answers 400 for a body without a list, before Hasura", async () => {
      const res = await ctx.as(
        ctx.t.http().put(`${BASE}/categories/order`).send({ categoryIds: "x" }),
      );

      expect(res.status).toBe(400);
      expect(ctx.t.graphql.request).not.toHaveBeenCalled();
    });
  });
});
