import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CrlScheduler } from "../../src/crls/services/CrlScheduler";
import { DashboardService } from "../../src/dashboard/services/DashboardService";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  type Hierarchy,
  makeCsr,
  startHarness,
  type Harness,
} from "../support/e2e";

const DAY = 24 * 60 * 60 * 1000;

type Dashboard = {
  asOf: string;
  certificates: {
    valid: number;
    issuers: number;
    dueWithin30Days: number;
    dueManual: number;
    expiredRecently: number;
    expiredNames: string[];
    revoked: number;
    revokedThisWeek: number;
  };
  expiring: {
    certificateId: string;
    name: string;
    issuerId: string;
    notAfter: string;
    renewalDueAt: string;
    renewal: string;
  }[];
  attention: {
    kind: string;
    severity: string;
    subjectType: string;
    subjectId: string;
    title: string;
  }[];
  crls: { issuerId: string; tier: string; offline: boolean; number?: string }[];
  week: { issued: number; renewals: number };
  ca: {
    auditEvents: number;
    lastCeremony?: { issuerId: string };
    nextCeremonyIssuerId?: string;
  };
};

/**
 * The console's dashboard (GET /v1/dashboard): the certificates counted,
 * what expires and has not been replaced, what needs a person, and each
 * CA's newest list. Times ahead are read through the service.
 */
describe.skipIf(!E2E_DATABASE_URL)("dashboard", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  const server = () => harness.app.getHttpServer();
  const tls = "tls-issuing-1-g1";

  const issue = async (commonName: string) => {
    const { csr } = await makeCsr(commonName, [commonName]);
    return (
      (
        await request(server())
          .post("/v1/certificates")
          .set("Authorization", harness.operator)
          .send({
            profileId: "internal-tls",
            subject: { commonName },
            names: { dns: [commonName] },
            csr,
          })
          .expect(201)
      ).body as { certificate: { id: string; serial: string } }
    ).certificate;
  };

  const dashboard = async () =>
    (
      (
        await request(server())
          .get("/v1/dashboard")
          .set("Authorization", harness.operator)
          .expect(200)
      ).body as { dashboard: Dashboard }
    ).dashboard;

  /** The dashboard as it will read `days` from now, as the API writes it. */
  const later = async (days: number) =>
    JSON.parse(
      JSON.stringify(
        await harness.app
          .get(DashboardService)
          .read(new Date(Date.now() + days * DAY)),
        (_, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
      ),
    ) as Dashboard;

  beforeAll(async () => {
    harness = await startHarness();
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
    ]);
    await harness.app.get(CrlScheduler).run();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("counts what the CA holds, and lists each CA's newest list", async () => {
    await issue("dash-a.internal.ncfritz.net");
    const read = await dashboard();
    expect(read.certificates).toMatchObject({
      valid: 1,
      issuers: 1,
      dueWithin30Days: 0,
      expiredRecently: 0,
      revoked: 0,
    });
    expect(read.week.issued).toBe(1);
    // Online CAs first.
    expect(read.crls[0]).toMatchObject({
      issuerId: tls,
      offline: false,
      number: expect.any(String),
    });
    expect(read.crls.map((c) => c.issuerId)).toEqual(
      expect.arrayContaining([hierarchy.root.id, hierarchy.intermediate.id]),
    );
    expect(read.ca.auditEvents).toBeGreaterThan(0);
    expect(read.ca.lastCeremony).toBeDefined();
    // The offline CAs' lists lapse first: a ceremony renews them.
    expect([hierarchy.root.id, hierarchy.intermediate.id]).toContain(
      read.ca.nextCeremonyIssuerId,
    );
  });

  it("lists what expires within 90 days, and what is past its renewal point needs a person", async () => {
    const certificate = await issue("dash-b.internal.ncfritz.net");
    // internal-tls: 90 days, renewed at 60: due 30 days before expiry.
    const soon = await later(40);
    const expiring = soon.expiring.find(
      (e) => e.certificateId === certificate.id,
    );
    expect(expiring).toMatchObject({
      name: "dash-b.internal.ncfritz.net",
      issuerId: tls,
      renewal: "manual",
    });
    expect(
      Date.parse(expiring!.notAfter) - Date.parse(expiring!.renewalDueAt),
    ).toBe(30 * DAY);
    expect(
      soon.attention.find((a) => a.subjectId === certificate.id),
    ).toBeUndefined();

    const due = await later(65);
    expect(due.certificates.dueWithin30Days).toBeGreaterThanOrEqual(1);
    expect(due.certificates.dueManual).toBe(due.certificates.dueWithin30Days);
    expect(due.attention).toContainEqual(
      expect.objectContaining({
        kind: "certificate-due",
        severity: "warning",
        subjectType: "certificate",
        subjectId: certificate.id,
      }),
    );
    // Within a week of expiry, it is an error.
    const urgent = await later(85);
    expect(urgent.attention).toContainEqual(
      expect.objectContaining({
        subjectId: certificate.id,
        severity: "error",
      }),
    );
    // Expired, it is counted as such.
    const gone = await later(95);
    expect(gone.certificates.expiredNames).toContain(
      "dash-b.internal.ncfritz.net",
    );
  });

  it("leaves out a certificate its CA has replaced for the same subject", async () => {
    const first = await issue("dash-c.internal.ncfritz.net");
    // An ACME client's next order: a new certificate naming none it renews.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await issue("dash-c.internal.ncfritz.net");
    const read = await later(40);
    const ids = read.expiring.map((e) => e.certificateId);
    expect(ids).toContain(second.id);
    expect(ids).not.toContain(first.id);
  });

  it("counts revocations", async () => {
    const certificate = await issue("dash-d.internal.ncfritz.net");
    await request(server())
      .post(`/v1/certificate/${certificate.id}/revoke`)
      .set("Authorization", harness.operator)
      .send({ reason: "superseded" })
      .expect(200);
    const read = await dashboard();
    expect(read.certificates).toMatchObject({ revoked: 1, revokedThisWeek: 1 });
    expect(read.expiring.map((e) => e.certificateId)).not.toContain(
      certificate.id,
    );
  });

  it("needs a PKI role", async () => {
    await request(server()).get("/v1/dashboard").expect(401);
  });
});
