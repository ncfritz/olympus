import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  E2E_DATABASE_URL,
  EXPORT_PASSPHRASE,
  startHarness,
  type Harness,
} from "../support/e2e";

type Preview = {
  id: string;
  subject: string;
  organization: string;
  validityDays: number;
  pathLength: number;
  keyUsages: string[];
  extendedKeyUsages: string[];
  maxValidityDays: number;
  crlDistributionPoint?: string;
};

type Answer = { preview: Preview; defaults: Preview; problems: string[] };

const SERVER_AUTH = "1.3.6.1.5.5.7.3.1";

/**
 * Previewing a CA before it is created (ADR 0032, Names and settings):
 * its settings beside their defaults, and what creating it would refuse,
 * with nothing signed or recorded.
 */
describe.skipIf(!E2E_DATABASE_URL)("previewing a CA", () => {
  let harness: Harness;
  const server = () => harness.app.getHttpServer();

  const preview = async (body: Record<string, unknown>) =>
    (
      await request(server())
        .post("/v1/issuers/preview")
        .set("Authorization", harness.admin)
        .send({ generation: 1, ...body })
        .expect(200)
    ).body as Answer;

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("shows a root at its defaults, and records nothing", async () => {
    const {
      preview: root,
      defaults,
      problems,
    } = await preview({
      tier: "root",
      number: 1,
      shape: "two_tier",
    });
    expect(problems).toEqual([]);
    expect(root).toEqual(defaults);
    expect(root).toMatchObject({
      id: "root-1-g1",
      subject: "CN=ncfritz.net Test Root CA 1 - G1,O=ncfritz.net",
      validityDays: 7300,
      pathLength: 1,
      keyUsages: ["key_cert_sign", "crl_sign"],
      maxValidityDays: 1825,
    });
    expect(await harness.prisma.issuer.count()).toBe(0);
    await request(server())
      .post("/v1/issuers/preview")
      .set("Authorization", harness.operator)
      .send({ tier: "root", number: 1, generation: 1 })
      .expect(403);
  });

  it("shows what an override changes beside the default", async () => {
    const { preview: root, defaults } = await preview({
      tier: "root",
      number: 2,
      purpose: "Dev",
      organization: "Example Lab",
      validityDays: 3650,
    });
    expect(root).toMatchObject({
      subject: "CN=Example Lab Dev Root CA 2 - G1,O=Example Lab",
      organization: "Example Lab",
      validityDays: 3650,
    });
    expect(defaults).toMatchObject({
      subject: "CN=ncfritz.net Test Dev Root CA 2 - G1,O=ncfritz.net",
      organization: "ncfritz.net",
      validityDays: 7300,
    });
  });

  it("refuses a CA too short-lived to sign what it signs", async () => {
    const { problems } = await preview({
      tier: "root",
      number: 4,
      validityDays: 3650,
    });
    expect(problems).toEqual([
      "3650 days leaves it no time to sign: what it signs lasts up to 3650 days, so it needs more than 3680",
    ]);
    const refused = await request(server())
      .post("/v1/issuers/roots")
      .set("Authorization", harness.admin)
      .send({
        number: 4,
        generation: 1,
        validityDays: 3650,
        exportPassphrase: EXPORT_PASSPHRASE,
      })
      .expect(422);
    expect(refused.body.message).toMatch(/no time to sign/);
  });

  describe("beneath a root", () => {
    let rootId: string;

    beforeAll(async () => {
      const created = await request(server())
        .post("/v1/issuers/roots")
        .set("Authorization", harness.admin)
        .send({
          number: 3,
          generation: 1,
          organization: "Example Lab",
          shape: "two_tier",
          exportPassphrase: EXPORT_PASSPHRASE,
        })
        .expect(201);
      rootId = (created.body as { issuer: { id: string } }).issuer.id;
    });

    it("takes the root's organisation and its purpose's profiles", async () => {
      const { preview: issuing, problems } = await preview({
        tier: "issuing",
        parentId: rootId,
        purpose: "TLS",
        number: 1,
      });
      expect(problems).toEqual([]);
      expect(issuing).toMatchObject({
        id: "tls-issuing-1-g1",
        subject: "CN=Example Lab TLS Issuing CA 1 - G1,O=Example Lab",
        validityDays: 1825,
        pathLength: 0,
        keyUsages: ["digital_signature", "key_cert_sign", "crl_sign"],
      });
      expect(issuing.crlDistributionPoint).toMatch(
        new RegExp(`/crl/${rootId}\\.crl$`),
      );
      expect(issuing.extendedKeyUsages).toContain(SERVER_AUTH);
      expect(issuing.maxValidityDays).toBeGreaterThan(0);
    });

    it("says why creating it would be refused", async () => {
      const { problems } = await preview({
        tier: "intermediate",
        parentId: rootId,
        number: 1,
        validityDays: 36500,
        subject: "CN=Example Lab Root CA 3 - G1,O=Example Lab",
      });
      expect(problems).toEqual([
        `${rootId} signs issuing CAs, not intermediate CAs`,
        expect.stringMatching(/^36500 days would outlive its parent/),
        expect.stringMatching(/a subject is never reused$/),
      ]);
      const orphan = await preview({ tier: "issuing", number: 1 });
      expect(orphan.problems).toEqual([
        "An issuing CA needs the CA that signs it",
        "An issuing CA needs a purpose: TLS, Service, ...",
        "No profile issues from a purposeless CA: give its maximum validity and extended key usages",
      ]);
    });
  });
});
