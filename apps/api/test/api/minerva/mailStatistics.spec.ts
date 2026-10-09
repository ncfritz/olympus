import moment from "moment";
import { describe, expect, it } from "vitest";
import { MAIL_STATISTICS_TOP } from "../../../src/minerva/mail/services/MailStatisticsService";
import { signedInApp, USER } from "../../support/signedInApp";

const STATISTICS = "/v1/minerva/mail/statistics";

const statistics = (overrides: Record<string, unknown> = {}) => ({
  minerva_mail_statistics_summary: [
    {
      messages: "275358",
      labelsInUse: 482,
      senders: "8996",
      unlabelled: 5630,
      firstReceivedTime: "2007-03-23T10:00:00+00:00",
      lastReceivedTime: "2026-10-02T18:00:00+00:00",
    },
  ],
  minerva_mail_top_senders: [
    {
      address: "billing@power.example",
      name: "Power Co",
      messages: "118475",
      lastReceivedTime: "2026-10-02T18:00:00+00:00",
    },
    {
      address: "friend@mail.example",
      name: null,
      messages: 12,
      lastReceivedTime: "2025-01-01T00:00:00+00:00",
    },
  ],
  minerva_mail_top_labels: [
    {
      name: "Accounts/Utilities/Power",
      messages: 118475,
      senders: "3",
      lastReceivedTime: "2026-10-02T18:00:00+00:00",
    },
  ],
  minerva_mail_sender_years: [
    { address: "billing@power.example", year: 2025, messages: "51000" },
    { address: "billing@power.example", year: 2026, messages: 40000 },
  ],
  minerva_mail_label_years: [
    { name: "Accounts/Utilities/Power", year: 2026, messages: 40000 },
  ],
  ...overrides,
});

/**
 * GetMailStatistics: the Statistics page's numbers over the caller's own
 * mail (docs/plans/email-management phase 2).
 */
describe("GET /v1/minerva/mail/statistics (GetMailStatistics)", () => {
  const ctx = signedInApp();
  const t = () => ctx.t;

  it("answers 401 without an identity and asks Hasura nothing", async () => {
    const res = await t().http().get(STATISTICS);
    expect(res.status).toBe(401);
    expect(t().graphql.request).not.toHaveBeenCalled();
  });

  it("counts the caller's mail for the last twelve months, all mail, by default", async () => {
    t().graphql.on("GetMailStatistics", statistics());
    const before = moment();

    const res = await ctx.as(t().http().get(STATISTICS));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      range: "12m",
      scope: "all",
      summary: {
        messages: 275358,
        labelsInUse: 482,
        senders: 8996,
        unlabelled: 5630,
      },
      topSenders: [
        {
          address: "billing@power.example",
          name: "Power Co",
          messages: 118475,
        },
        { address: "friend@mail.example", messages: 12 },
      ],
      topLabels: [
        { name: "Accounts/Utilities/Power", messages: 118475, senders: 3 },
      ],
      senderActivity: [
        { address: "billing@power.example", year: 2025, messages: 51000 },
        { address: "billing@power.example", year: 2026, messages: 40000 },
      ],
      labelActivity: [
        { name: "Accounts/Utilities/Power", year: 2026, messages: 40000 },
      ],
    });
    expect(res.body.topSenders[1]).not.toHaveProperty("name");
    expect(moment(res.body.summary.firstReceivedTime).year()).toBe(2007);

    const variables = t().graphql.calls("GetMailStatistics")[0]
      .variables as Record<string, unknown>;
    expect(variables).toMatchObject({
      userId: USER,
      scope: "all",
      topSenders: MAIL_STATISTICS_TOP.senders,
      topLabels: MAIL_STATISTICS_TOP.labels,
      senderActivity: MAIL_STATISTICS_TOP.senderActivity,
      labelActivity: MAIL_STATISTICS_TOP.labelActivity,
    });
    const since = moment(variables.since as string);
    expect(moment(res.body.sinceTime).isSame(since)).toBe(true);
    // Twelve months before the request, give or take the test's own time.
    expect(
      Math.abs(since.diff(moment(before).subtract(12, "months"), "seconds")),
    ).toBeLessThan(60);
  });

  it("counts all time, with no start, and the requested scope", async () => {
    t().graphql.on("GetMailStatistics", statistics());

    const res = await ctx.as(
      t().http().get(`${STATISTICS}?range=all&scope=sent`),
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ range: "all", scope: "sent" });
    expect(res.body).not.toHaveProperty("sinceTime");
    expect(t().graphql.calls("GetMailStatistics")[0].variables).toMatchObject({
      since: null,
      scope: "sent",
    });
  });

  it("counts three years back", async () => {
    t().graphql.on("GetMailStatistics", statistics());
    const before = moment();

    await ctx.as(t().http().get(`${STATISTICS}?range=3y&scope=received`));

    const variables = t().graphql.calls("GetMailStatistics")[0]
      .variables as Record<string, unknown>;
    expect(variables.scope).toBe("received");
    expect(
      Math.abs(
        moment(variables.since as string).diff(
          moment(before).subtract(3, "years"),
          "seconds",
        ),
      ),
    ).toBeLessThan(60);
  });

  it("answers zeros, and no times, for a caller without mail", async () => {
    t().graphql.on(
      "GetMailStatistics",
      statistics({
        minerva_mail_statistics_summary: [
          {
            messages: 0,
            labelsInUse: 0,
            senders: 0,
            unlabelled: 0,
            firstReceivedTime: null,
            lastReceivedTime: null,
          },
        ],
        minerva_mail_top_senders: [],
        minerva_mail_top_labels: [],
        minerva_mail_sender_years: [],
        minerva_mail_label_years: [],
      }),
    );

    const res = await ctx.as(t().http().get(STATISTICS));

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      messages: 0,
      labelsInUse: 0,
      senders: 0,
      unlabelled: 0,
    });
    expect(res.body.topSenders).toEqual([]);
  });

  it.each([
    ["an unknown range", "range=6m"],
    ["an unknown scope", "scope=inbox"],
    ["an empty range", "range="],
  ])("answers 400 for %s and asks Hasura nothing", async (_case, query) => {
    const res = await ctx.as(t().http().get(`${STATISTICS}?${query}`));
    expect(res.status).toBe(400);
    expect(t().graphql.request).not.toHaveBeenCalled();
  });
});
