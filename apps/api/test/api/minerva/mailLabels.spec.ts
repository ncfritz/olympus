import { describe, expect, it } from "vitest";
import { signedInApp, USER } from "../../support/signedInApp";

const ACCOUNT = "7b2b0000-0000-4000-8000-000000000001";
const OTHER_ACCOUNT = "7b2b0000-0000-4000-8000-0000000000ff";
const SRP = "9a1a0000-0000-4000-8000-000000000001";
const PAYABLE = "9a1a0000-0000-4000-8000-000000000002";
const PAID = "9a1a0000-0000-4000-8000-000000000003";
const ADS = "9a1a0000-0000-4000-8000-000000000004";
const UPDATES = "9a1a0000-0000-4000-8000-000000000005";
const FAMILY = "9b1b0000-0000-4000-8000-000000000001";

type Label = Record<string, unknown> & { id: string };

const label = (overrides: Record<string, unknown> = {}): Label => ({
  id: SRP,
  accountId: ACCOUNT,
  name: "Bills/SRP",
  type: "user",
  kind: "topical",
  familyId: null,
  stateOpen: null,
  mergeTargetId: null,
  family: null,
  mergeTarget: null,
  ...overrides,
});

const payable = label({ id: PAYABLE, name: "Bills/*Payable" });
const paid = label({ id: PAID, name: "Bills/*Paid" });

const family = {
  id: FAMILY,
  accountId: ACCOUNT,
  name: "Bills",
  initialLabelId: PAYABLE,
  states: [
    { id: PAID, name: "Bills/*Paid", stateOpen: false },
    { id: PAYABLE, name: "Bills/*Payable", stateOpen: true },
  ],
  transitions: [{ fromLabelId: PAYABLE, toLabelId: PAID }],
};

const bills = {
  name: "Bills",
  states: [
    { labelId: PAYABLE, open: true },
    { labelId: PAID, open: false },
  ],
  initialLabelId: PAYABLE,
  transitions: [{ fromLabelId: PAYABLE, toLabelId: PAID }],
};

/**
 * Label kinds and families (ADR 0030, Label kinds; docs/plans/
 * email-management phase 3), each over the caller's own labels.
 */
describe("Mail labels API", () => {
  const ctx = signedInApp();
  const t = () => ctx.t;

  /** Answer DescribeMailLabels with those of `labels` the call asks for. */
  const known = (...labels: Label[]) =>
    t().graphql.on("DescribeMailLabels", (variables) => ({
      minerva_mail_labels: labels.filter((l) =>
        (variables as { ids: string[] }).ids.includes(l.id),
      ),
    }));

  it.each([
    ["get", "/v1/minerva/mail/labels"],
    ["put", `/v1/minerva/mail/label/${SRP}`],
    ["get", "/v1/minerva/mail/families"],
    ["post", "/v1/minerva/mail/families"],
    ["delete", `/v1/minerva/mail/family/${FAMILY}`],
  ] as const)(
    "%s %s answers 401 without an identity and asks Hasura nothing",
    async (method, path) => {
      const res = await t().http()[method](path);
      expect(res.status).toBe(401);
      expect(t().graphql.request).not.toHaveBeenCalled();
    },
  );

  describe("GET /v1/minerva/mail/labels (ListMailLabels)", () => {
    it("answers the caller's labels with kinds, families, targets and counts", async () => {
      t().graphql.on("ListMailLabels", {
        minerva_mail_labels: [
          {
            ...payable,
            kind: "state",
            familyId: FAMILY,
            stateOpen: true,
            family: { name: "Bills" },
            messageLabels_aggregate: { aggregate: { count: 2 } },
          },
          {
            ...label({ id: ADS, name: "Advertisements" }),
            kind: "retired",
            mergeTargetId: SRP,
            mergeTarget: { name: "Bills/SRP" },
            messageLabels_aggregate: { aggregate: { count: 12 } },
          },
          {
            ...label({ id: UPDATES, name: "CATEGORY_UPDATES" }),
            type: "system",
            kind: "system",
            messageLabels_aggregate: { aggregate: { count: 900 } },
          },
        ],
      });

      const res = await ctx.as(t().http().get("/v1/minerva/mail/labels"));

      expect(res.status).toBe(200);
      expect(res.body.labels).toEqual([
        {
          id: PAYABLE,
          accountId: ACCOUNT,
          name: "Bills/*Payable",
          kind: "state",
          messages: 2,
          familyId: FAMILY,
          familyName: "Bills",
          stateOpen: true,
        },
        {
          id: ADS,
          accountId: ACCOUNT,
          name: "Advertisements",
          kind: "retired",
          messages: 12,
          mergeTargetId: SRP,
          mergeTargetName: "Bills/SRP",
        },
        {
          id: UPDATES,
          accountId: ACCOUNT,
          name: "CATEGORY_UPDATES",
          kind: "system",
          messages: 900,
        },
      ]);
      expect(t().graphql.calls("ListMailLabels")[0].variables).toEqual({
        userId: USER,
      });
    });
  });

  describe("PUT /v1/minerva/mail/label/:labelId (UpdateMailLabel)", () => {
    const put = (id: string, body: unknown) =>
      ctx.as(
        t()
          .http()
          .put(`/v1/minerva/mail/label/${id}`)
          .send(body as object),
      );

    it("retires a label into another of its account's", async () => {
      known(label({ id: ADS, name: "Advertisements" }), label());
      t().graphql.on("DescribeMailLabelMerges", { minerva_mail_labels: [] });
      t().graphql.on("UpdateMailLabel", {
        update_minerva_mail_labels_by_pk: {
          ...label({ id: ADS, name: "Advertisements" }),
          kind: "retired",
          mergeTargetId: SRP,
          mergeTarget: { name: "Bills/SRP" },
          messageLabels_aggregate: { aggregate: { count: 12 } },
        },
      });

      const res = await put(ADS, { kind: "retired", mergeTargetId: SRP });

      expect(res.status).toBe(200);
      expect(res.body.label).toMatchObject({
        kind: "retired",
        mergeTargetName: "Bills/SRP",
      });
      expect(t().graphql.calls("DescribeMailLabels")[0].variables).toEqual({
        userId: USER,
        ids: [ADS, SRP],
      });
      expect(t().graphql.calls("UpdateMailLabel")[0].variables).toEqual({
        id: ADS,
        kind: "retired",
        target: SRP,
      });
    });

    it("makes a retired label topical, without a target", async () => {
      known(label({ id: ADS, kind: "retired", mergeTargetId: SRP }));
      t().graphql.on("UpdateMailLabel", {
        update_minerva_mail_labels_by_pk: label({ id: ADS }),
      });

      const res = await put(ADS, { kind: "topical" });

      expect(res.status).toBe(200);
      expect(t().graphql.calls("UpdateMailLabel")[0].variables).toEqual({
        id: ADS,
        kind: "topical",
        target: null,
      });
    });

    it("answers 404 for a label that is not the caller's", async () => {
      known();
      const res = await put(ADS, { kind: "topical" });
      expect(res.status).toBe(404);
      expect(t().graphql.calls("UpdateMailLabel")).toHaveLength(0);
    });

    it("answers 404 for a target that is not the caller's", async () => {
      known(label({ id: ADS }));
      const res = await put(ADS, { kind: "retired", mergeTargetId: SRP });
      expect(res.status).toBe(404);
    });

    it.each([
      ["a state, which joins through a family", { kind: "state" }],
      ["system", { kind: "system" }],
      ["no kind", {}],
      ["retired without a target", { kind: "retired" }],
      ["a target that is not an ID", { kind: "retired", mergeTargetId: "SRP" }],
      ["topical with a target", { kind: "topical", mergeTargetId: SRP }],
    ])("answers 400 for %s and asks Hasura nothing", async (_case, body) => {
      const res = await put(ADS, body);
      expect(res.status).toBe(400);
      expect(t().graphql.request).not.toHaveBeenCalled();
    });

    it("answers 400 for a label ID that is not one", async () => {
      const res = await put("srp", { kind: "topical" });
      expect(res.status).toBe(400);
    });

    it.each([
      [
        "answers 400 for a system label",
        [label({ id: UPDATES, type: "system", kind: "system" })],
        UPDATES,
        { kind: "topical" },
        400,
      ],
      [
        "answers 409 for a state",
        [
          label({
            id: PAYABLE,
            kind: "state",
            familyId: FAMILY,
            stateOpen: true,
            family: { name: "Bills" },
          }),
        ],
        PAYABLE,
        { kind: "topical" },
        409,
      ],
      [
        "answers 400 for a merge into itself",
        [label({ id: ADS })],
        ADS,
        { kind: "retired", mergeTargetId: ADS },
        400,
      ],
      [
        "answers 400 for a merge into another account's",
        [label({ id: ADS }), label({ accountId: OTHER_ACCOUNT })],
        ADS,
        { kind: "retired", mergeTargetId: SRP },
        400,
      ],
      [
        "answers 409 for a merge into a retired label",
        [label({ id: ADS }), label({ kind: "retired", mergeTargetId: PAID })],
        ADS,
        { kind: "retired", mergeTargetId: SRP },
        409,
      ],
    ])("%s", async (_case, labels, id, body, status) => {
      known(...labels);
      const res = await put(id, body);
      expect(res.status).toBe(status);
      expect(t().graphql.calls("UpdateMailLabel")).toHaveLength(0);
    });

    it("answers 409 for retiring a label others merge into", async () => {
      known(label({ id: ADS }), label());
      t().graphql.on("DescribeMailLabelMerges", {
        minerva_mail_labels: [{ id: PAID }],
      });
      const res = await put(ADS, { kind: "retired", mergeTargetId: SRP });
      expect(res.status).toBe(409);
      expect(t().graphql.calls("UpdateMailLabel")).toHaveLength(0);
    });
  });

  describe("GET /v1/minerva/mail/families (ListMailLabelFamilies)", () => {
    it("answers the caller's families with states and transitions", async () => {
      t().graphql.on("ListMailLabelFamilies", {
        minerva_mail_label_families: [family],
      });

      const res = await ctx.as(t().http().get("/v1/minerva/mail/families"));

      expect(res.status).toBe(200);
      expect(res.body.families).toEqual([
        {
          id: FAMILY,
          accountId: ACCOUNT,
          name: "Bills",
          initialLabelId: PAYABLE,
          states: [
            { labelId: PAID, name: "Bills/*Paid", open: false },
            { labelId: PAYABLE, name: "Bills/*Payable", open: true },
          ],
          transitions: [{ fromLabelId: PAYABLE, toLabelId: PAID }],
        },
      ]);
    });
  });

  describe("POST /v1/minerva/mail/families (CreateMailLabelFamily)", () => {
    const post = (body: unknown) =>
      ctx.as(
        t()
          .http()
          .post("/v1/minerva/mail/families")
          .send(body as object),
      );

    it("makes the labels its states in one mutation, then answers the family", async () => {
      known(payable, paid);
      t().graphql.on("DescribeMailLabelFamilyByName", {
        minerva_mail_label_families: [],
      });
      t().graphql.on("CreateMailLabelFamily", {});
      t().graphql.on("DescribeMailLabelFamily", {
        minerva_mail_label_families: [family],
      });

      const res = await post(bills);

      expect(res.status).toBe(201);
      // No GET route for one family, so no Location (conventions/api.md).
      expect(res.headers.location).toBeUndefined();
      expect(res.body.family).toMatchObject({
        name: "Bills",
        initialLabelId: PAYABLE,
      });
      const variables = t().graphql.calls("CreateMailLabelFamily")[0]
        .variables as {
        family: { id: string };
        states: unknown[];
        transitions: unknown[];
      };
      const id = variables.family.id;
      expect(variables).toEqual({
        family: {
          id,
          accountId: ACCOUNT,
          name: "Bills",
          initialLabelId: PAYABLE,
        },
        states: [
          {
            where: { id: { _eq: PAYABLE } },
            _set: { kind: "state", familyId: id, stateOpen: true },
          },
          {
            where: { id: { _eq: PAID } },
            _set: { kind: "state", familyId: id, stateOpen: false },
          },
        ],
        transitions: [{ familyId: id, fromLabelId: PAYABLE, toLabelId: PAID }],
      });
      expect(t().graphql.calls("DescribeMailLabelFamily")[0].variables).toEqual(
        { userId: USER, familyId: id },
      );
    });

    it.each([
      ["no name", { ...bills, name: " " }],
      ["one state", { ...bills, states: [bills.states[0]] }],
      [
        "a state without open or closed",
        { ...bills, states: [{ labelId: PAYABLE }, bills.states[1]] },
      ],
      [
        "a label twice",
        { ...bills, states: [bills.states[0], bills.states[0]] },
      ],
      ["an initial state not among them", { ...bills, initialLabelId: SRP }],
      ["a closed initial state", { ...bills, initialLabelId: PAID }],
      [
        "a transition to a label outside the family",
        { ...bills, transitions: [{ fromLabelId: PAYABLE, toLabelId: SRP }] },
      ],
      [
        "a transition to itself",
        { ...bills, transitions: [{ fromLabelId: PAID, toLabelId: PAID }] },
      ],
      ["transitions that are not a list", { ...bills, transitions: "all" }],
    ])("answers 400 for %s and asks Hasura nothing", async (_case, body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(t().graphql.request).not.toHaveBeenCalled();
    });

    it("answers 404 for a label that is not the caller's", async () => {
      known(payable);
      const res = await post(bills);
      expect(res.status).toBe(404);
      expect(t().graphql.calls("CreateMailLabelFamily")).toHaveLength(0);
    });

    it("answers 409 for a label that is not topical", async () => {
      known(payable, { ...paid, kind: "retired", mergeTargetId: SRP });
      const res = await post(bills);
      expect(res.status).toBe(409);
    });

    it("answers 400 for labels of two accounts", async () => {
      known(payable, { ...paid, accountId: OTHER_ACCOUNT });
      const res = await post(bills);
      expect(res.status).toBe(400);
    });

    it("answers 409 for a name the account has", async () => {
      known(payable, paid);
      t().graphql.on("DescribeMailLabelFamilyByName", {
        minerva_mail_label_families: [{ id: FAMILY }],
      });
      const res = await post(bills);
      expect(res.status).toBe(409);
      expect(t().graphql.calls("CreateMailLabelFamily")).toHaveLength(0);
    });
  });

  describe("DELETE /v1/minerva/mail/family/:familyId (DeleteMailLabelFamily)", () => {
    it("gives the states back as topical labels and removes the family", async () => {
      t().graphql.on("DescribeMailLabelFamily", {
        minerva_mail_label_families: [family],
      });
      t().graphql.on("DeleteMailLabelFamily", {});

      const res = await ctx.as(
        t().http().delete(`/v1/minerva/mail/family/${FAMILY}`),
      );

      expect(res.status).toBe(204);
      expect(t().graphql.calls("DeleteMailLabelFamily")[0].variables).toEqual({
        familyId: FAMILY,
      });
    });

    it("answers 404 for a family that is not the caller's", async () => {
      t().graphql.on("DescribeMailLabelFamily", {
        minerva_mail_label_families: [],
      });
      const res = await ctx.as(
        t().http().delete(`/v1/minerva/mail/family/${FAMILY}`),
      );
      expect(res.status).toBe(404);
      expect(t().graphql.calls("DeleteMailLabelFamily")).toHaveLength(0);
    });

    it("answers 400 for a family ID that is not one", async () => {
      const res = await ctx.as(
        t().http().delete("/v1/minerva/mail/family/bills"),
      );
      expect(res.status).toBe(400);
    });
  });
});
