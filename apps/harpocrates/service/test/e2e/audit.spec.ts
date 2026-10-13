import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  makeCsr,
  startHarness,
  type Harness,
} from "../support/e2e";

type Event = {
  sequence: string;
  kind: string;
  group: string;
  sensitive: boolean;
  principal: string;
  surface: string;
  reason?: string;
  subjectName?: string;
};

/**
 * The audit log as the console reads it: events by group, by who acted,
 * sensitive or not, since a time, by text (GET /v1/audit/events), and the
 * activity its graphs draw (GET /v1/audit/activity).
 */
describe.skipIf(!E2E_DATABASE_URL)("audit", () => {
  let harness: Harness;
  let revoked: string;
  const server = () => harness.app.getHttpServer();

  const events = async (query: Record<string, string>) =>
    (
      (
        await request(server())
          .get("/v1/audit/events")
          .query(query)
          .set("Authorization", harness.operator)
          .expect(200)
      ).body as { events: Event[] }
    ).events;

  beforeAll(async () => {
    harness = await startHarness();
    await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
    ]);
    const { csr } = await makeCsr("audit-a.internal.ncfritz.net", [
      "audit-a.internal.ncfritz.net",
    ]);
    const issued = (
      await request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.operator)
        .send({
          profileId: "internal-tls",
          subject: { commonName: "audit-a.internal.ncfritz.net" },
          names: { dns: ["audit-a.internal.ncfritz.net"] },
          csr,
        })
        .expect(201)
    ).body as { certificate: { id: string } };
    revoked = issued.certificate.id;
    await request(server())
      .post(`/v1/certificate/${revoked}/revoke`)
      .set("Authorization", harness.operator)
      .send({ reason: "superseded", comment: "A replaced listener" })
      .expect(200);
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("says what each event concerns and whether it is sensitive", async () => {
    const all = await events({});
    expect(all.find((e) => e.kind === "certificate.issued")).toMatchObject({
      group: "certificates",
      sensitive: false,
    });
    expect(all.find((e) => e.kind === "certificate.revoked")).toMatchObject({
      group: "certificates",
      sensitive: true,
      // Named, not only by its ID.
      subjectName: "audit-a.internal.ncfritz.net",
    });
    expect(all.find((e) => e.kind === "ceremony.opened")).toMatchObject({
      group: "ceremonies",
      sensitive: true,
    });
  });

  it("filters by groups", async () => {
    const certificates = await events({ groups: "certificates" });
    expect(certificates.length).toBeGreaterThan(0);
    expect(certificates.every((e) => e.kind.startsWith("certificate."))).toBe(
      true,
    );
    const two = await events({ groups: "certificates,ceremonies" });
    expect(new Set(two.map((e) => e.group))).toEqual(
      new Set(["certificates", "ceremonies"]),
    );
    await request(server())
      .get("/v1/audit/events")
      .query({ groups: "certificates,nonsense" })
      .set("Authorization", harness.operator)
      .expect(400);
  });

  it("filters by who acted, and by sensitivity", async () => {
    const people = await events({ actor: "people" });
    expect(people.length).toBeGreaterThan(0);
    expect(people.every((e) => /^(user|cli):/.test(e.principal))).toBe(true);
    const sensitive = await events({ sensitive: "true" });
    expect(sensitive.map((e) => e.kind)).toContain("certificate.revoked");
    expect(sensitive.every((e) => e.sensitive)).toBe(true);
  });

  it("finds events by text, in their subject, reason or details", async () => {
    const found = await events({ search: revoked });
    expect(found.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["certificate.issued", "certificate.revoked"]),
    );
    expect(await events({ search: "no-such-thing-anywhere" })).toEqual([]);
  });

  it("filters by time", async () => {
    expect(
      await events({ since: new Date(Date.now() + 60_000).toISOString() }),
    ).toEqual([]);
    expect(
      (await events({ since: new Date(Date.now() - 3_600_000).toISOString() }))
        .length,
    ).toBeGreaterThan(0);
  });

  it("gives the activity of the last days, oldest first", async () => {
    const activity = (
      await request(server())
        .get("/v1/audit/activity")
        .query({ days: 7 })
        .set("Authorization", harness.operator)
        .expect(200)
    ).body as {
      asOf: string;
      since: string;
      points: (Event & { occurredAt: string })[];
    };
    expect(Date.parse(activity.asOf) - Date.parse(activity.since)).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    const sequences = activity.points.map((p) => BigInt(p.sequence));
    expect(sequences).toEqual([...sequences].sort((a, b) => (a < b ? -1 : 1)));
    expect(activity.points.at(-1)).toMatchObject({
      kind: "certificate.revoked",
      group: "certificates",
      sensitive: true,
      surface: "api",
    });
    await request(server())
      .get("/v1/audit/activity")
      .query({ days: 91 })
      .set("Authorization", harness.operator)
      .expect(400);
  });

  it("needs a PKI role", async () => {
    await request(server()).get("/v1/audit/activity").expect(401);
  });
});
