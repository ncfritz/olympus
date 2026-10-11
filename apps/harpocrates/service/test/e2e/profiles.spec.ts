import * as x509 from "@peculiar/x509";
import { createHash, webcrypto, X509Certificate } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  startHarness,
  type Harness,
  type Hierarchy,
} from "../support/e2e";
import { bearer } from "../support/tokens";

/** An SPKI's subjectPublicKey bits: what key identifiers hash. */
const subjectPublicKeyBits = (spki: Buffer): Buffer => {
  const element = (offset: number) => {
    let start = offset + 2;
    let length = spki[offset + 1];
    if (length & 0x80) {
      const count = length & 0x7f;
      length = spki.readUIntBE(offset + 2, count);
      start += count;
    }
    return { start, end: start + length };
  };
  const algorithm = element(element(0).start);
  const bits = element(algorithm.end);
  return spki.subarray(bits.start + 1, bits.end);
};

type Profile = {
  id: string;
  version: number;
  description: string;
  active: boolean;
  validityDays: number;
  renewAtDays: number;
  keyUsages: { usage: string; state: string }[];
};

/** A profile's settings, as a new one is made. */
const settings = {
  issuerPurpose: "Service",
  keyAlgorithm: "P-256",
  validityDays: 120,
  renewAtDays: 80,
  maxKeyAgeDays: 365,
  allowCsr: true,
  allowGenerated: true,
  legacyExport: false,
  minNames: 0,
  escrow: true,
  escrowOverridable: false,
  extensions: "standard",
  keyUsages: [{ usage: "digital_signature", state: "forced" }],
  extendedKeyUsages: [{ oid: OID.clientAuth, state: "forced" }],
  names: [{ type: "dns", presence: "allowed" }],
  namePolicy: [],
  subjectAttributes: [
    { attribute: "CN", presence: "required", locked: false, maxCount: 1 },
    { attribute: "OU", presence: "optional", locked: false, maxCount: 1 },
    { attribute: "O", presence: "optional", locked: false, maxCount: 1 },
  ],
  keyAlgorithms: [],
  csrSignatureHashes: [],
  signatureHash: "sha256",
  rsaPadding: "pkcs1v15",
  subjectKeyIdentifier: "sha1",
  authorityKeyIdentifier: "key_id",
  basicConstraints: "critical",
  includeCrlDistribution: true,
  includeCaIssuers: true,
  includeIssuerAltName: false,
  policies: [],
  customExtensions: [],
};

const days = (pem: string) => {
  const parsed = new X509Certificate(pem);
  return Math.round(
    (Date.parse(parsed.validTo) - Date.parse(parsed.validFrom)) / 86_400_000,
  );
};

/**
 * Profiles as versioned presets (ADR 0034, phase 10 step 2): made, edited
 * into versions, copied, deactivated and reactivated; certificates renew
 * under their own version until moved.
 */
describe.skipIf(!E2E_DATABASE_URL)("profiles", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  const server = () => harness.app.getHttpServer();
  const profile = (response: request.Response) =>
    (response.body as { profile: Profile }).profile;

  const create = (body: object, token = harness.admin) =>
    request(server())
      .post("/v1/profiles")
      .set("Authorization", token)
      .send({ profile: body });
  const edit = (id: string, body: object, token = harness.admin) =>
    request(server())
      .put(`/v1/profile/${id}`)
      .set("Authorization", token)
      .send({ profile: body });
  const issue = async (profileId: string, commonName: string) =>
    (
      (
        await request(server())
          .post("/v1/certificates")
          .set("Authorization", harness.operator)
          .send({ profileId, subject: { commonName } })
      ).body as { certificate: { id: string; certificate: string } }
    ).certificate;
  const renew = async (certificateId: string) =>
    (
      (
        await request(server())
          .post(`/v1/certificate/${certificateId}/renew`)
          .set("Authorization", harness.operator)
          .send({})
          .expect(201)
      ).body as { certificate: { id: string; certificate: string } }
    ).certificate;

  beforeAll(async () => {
    harness = await startHarness();
    hierarchy = await buildHierarchy(harness, [
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
    ]);
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("makes a profile at v1, an admin's after a recent sign-in", async () => {
    const response = await create({
      id: "web-client",
      description: "Web clients",
      ...settings,
    }).expect(201);
    expect(response.headers.location).toMatch(/\/profile\/web-client$/);
    expect(profile(response)).toMatchObject({
      id: "web-client",
      version: 1,
      active: true,
      validityDays: 120,
    });
    await create(
      { id: "by-operator", description: "x", ...settings },
      harness.operator,
    ).expect(403);
    await create(
      { id: "stale-admin", description: "x", ...settings },
      await bearer(["pki-admin"], 3600),
    ).expect(403);
    await create({
      id: "web-client",
      description: "again",
      ...settings,
    }).expect(409);
  });

  it("refuses settings that do not hold together", async () => {
    const refused = await create({
      id: "broken",
      description: "x",
      ...settings,
      renewAtDays: 120,
      allowCsr: false,
      allowGenerated: false,
    }).expect(422);
    expect(refused.body.message).toMatch(/renews at 120 days/);
    expect(refused.body.message).toMatch(/neither a CSR nor a generated key/);
    await create({
      id: "wrong-issuer",
      description: "x",
      ...settings,
      issuerPurpose: "TLS",
      issuerId: "service-issuing-1-g1",
    }).expect(422);
    await create({
      id: "Bad Name",
      description: "x",
      ...settings,
    }).expect(400);
  });

  it("edits into versions: a setting makes the next, the description none", async () => {
    expect(
      profile(
        await edit("web-client", { description: "Web clients, mTLS" }).expect(
          200,
        ),
      ),
    ).toMatchObject({ version: 1, description: "Web clients, mTLS" });
    expect(
      profile(await edit("web-client", { validityDays: 120 }).expect(200))
        .version,
    ).toBe(1);
    expect(
      profile(
        await edit("web-client", {
          validityDays: 60,
          renewAtDays: 40,
          keyUsages: [
            { usage: "digital_signature", state: "forced" },
            { usage: "key_agreement", state: "default" },
          ],
        }).expect(200),
      ),
    ).toMatchObject({
      version: 2,
      validityDays: 60,
      keyUsages: [
        { usage: "digital_signature", state: "forced" },
        { usage: "key_agreement", state: "default" },
      ],
    });
    await edit("web-client", { renewAtDays: 90 }).expect(422);
    await edit("web-client", { validityDays: 30 }, harness.operator).expect(
      403,
    );
    const versions = (
      await request(server())
        .get("/v1/profile/web-client/versions")
        .set("Authorization", harness.operator)
        .expect(200)
    ).body as { versions: { version: number; validityDays: number }[] };
    expect(versions.versions.map((v) => [v.version, v.validityDays])).toEqual([
      [2, 60],
      [1, 120],
    ]);
  });

  it("renews under the version issued under, until moved to another", async () => {
    const before = await issue("web-client", "versioned-client");
    expect(days(before.certificate)).toBe(60);
    await edit("web-client", { validityDays: 90, renewAtDays: 60 }).expect(200);
    expect(days((await renew(before.id)).certificate)).toBe(60);
    const renewed = await harness.prisma.certificate.findFirstOrThrow({
      where: { renewsId: before.id },
    });

    const moved = await request(server())
      .post("/v1/profile/web-client/move")
      .set("Authorization", harness.admin)
      .send({ certificateIds: [renewed.id], version: 3 })
      .expect(200);
    expect(moved.body).toEqual({ moved: 1 });
    expect(days((await renew(renewed.id)).certificate)).toBe(90);

    const elsewhere = await issue("service", "not-web-client");
    await request(server())
      .post("/v1/profile/web-client/move")
      .set("Authorization", harness.admin)
      .send({ certificateIds: [elsewhere.id], version: 3 })
      .expect(422);
    await request(server())
      .post("/v1/profile/web-client/move")
      .set("Authorization", harness.admin)
      .send({ certificateIds: [renewed.id], version: 9 })
      .expect(404);
  });

  it("deactivates: nothing new chooses it, what it issued renews", async () => {
    const issued = await issue("web-client", "before-deactivation");
    expect(
      profile(
        await request(server())
          .post("/v1/profile/web-client/deactivate")
          .set("Authorization", harness.admin)
          .expect(200),
      ).active,
    ).toBe(false);
    const refused = await request(server())
      .post("/v1/certificates")
      .set("Authorization", harness.operator)
      .send({ profileId: "web-client", subject: { commonName: "after" } })
      .expect(422);
    expect(refused.body.message).toMatch(/deactivated/);
    await renew(issued.id);
    expect(
      profile(
        await request(server())
          .post("/v1/profile/web-client/reactivate")
          .set("Authorization", harness.admin)
          .expect(200),
      ).active,
    ).toBe(true);
    await request(server())
      .post("/v1/certificates")
      .set("Authorization", harness.operator)
      .send({ profileId: "web-client", subject: { commonName: "after" } })
      .expect(201);
  });

  it("copies a version into a new profile's v1", async () => {
    const copied = await request(server())
      .post("/v1/profile/web-client/copy")
      .set("Authorization", harness.admin)
      .send({ id: "web-client-short", version: 2 })
      .expect(201);
    expect(copied.headers.location).toMatch(/\/profile\/web-client-short$/);
    expect(profile(copied)).toMatchObject({
      id: "web-client-short",
      version: 1,
      description: "Web clients, mTLS",
      validityDays: 60,
      keyUsages: [
        { usage: "digital_signature", state: "forced" },
        { usage: "key_agreement", state: "default" },
      ],
    });
    await request(server())
      .post("/v1/profile/web-client/copy")
      .set("Authorization", harness.admin)
      .send({ id: "service" })
      .expect(409);
    await request(server())
      .post("/v1/profile/web-client/copy")
      .set("Authorization", harness.admin)
      .send({ id: "web-client-none", version: 9 })
      .expect(404);
  });

  it("pins an issuer as a new version", async () => {
    expect(
      profile(
        await edit("service", { issuerId: "service-issuing-1-g1" }).expect(200),
      ),
    ).toMatchObject({ version: 2, issuerId: "service-issuing-1-g1" });
  });

  it("audits every change", async () => {
    const kinds = (
      await harness.prisma.auditEvent.findMany({
        where: { subjectType: "profile" },
        select: { kind: true },
      })
    ).map((e) => e.kind);
    expect(new Set(kinds)).toEqual(
      new Set([
        "profile.created",
        "profile.updated",
        "profile.deactivated",
        "profile.reactivated",
        "profile.enrollments-moved",
      ]),
    );
  });
  describe("rules at issuance", () => {
    const rules = {
      ...settings,
      issuerPurpose: "Service",
      extendedKeyUsages: [
        { oid: OID.clientAuth, state: "forced" },
        { oid: OID.serverAuth, state: "optional" },
      ],
      keyUsages: [
        { usage: "digital_signature", state: "forced" },
        { usage: "content_commitment", state: "default" },
        { usage: "key_agreement", state: "optional" },
      ],
      minNames: 1,
      names: [
        { type: "dns", presence: "required" },
        { type: "ip", presence: "allowed" },
      ],
      namePolicy: [
        { type: "dns", kind: "permitted", value: "internal.ncfritz.net" },
        { type: "dns", kind: "excluded", value: "secret.internal.ncfritz.net" },
        { type: "ip", kind: "permitted", value: "192.168.15.0/24" },
      ],
      subjectAttributes: [
        {
          attribute: "C",
          presence: "required",
          defaultValue: "US",
          locked: true,
          maxCount: 1,
        },
        { attribute: "ST", presence: "required", locked: false, maxCount: 1 },
        { attribute: "O", presence: "excluded", locked: false, maxCount: 1 },
        {
          attribute: "title",
          presence: "optional",
          locked: false,
          pattern: "[a-z]+",
          maxCount: 1,
        },
        { attribute: "CN", presence: "required", locked: false, maxCount: 1 },
      ],
      keyAlgorithms: ["P-256", "P-384"],
      csrSignatureHashes: ["sha384"],
    };
    const ask = (body: object) =>
      request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.operator)
        .send({ profileId: "ruled", ...body });
    const parsed = (response: request.Response) =>
      new x509.X509Certificate(
        (response.body as { certificate: { certificate: string } }).certificate
          .certificate,
      );
    const usages = (certificate: x509.X509Certificate) => ({
      ku: certificate.getExtension(x509.KeyUsagesExtension)?.usages,
      eku: certificate
        .getExtension(x509.ExtendedKeyUsageExtension)
        ?.usages.map(String),
    });
    const base = {
      subject: {
        commonName: "ruled",
        attributes: [{ type: "ST", value: "Oregon" }],
      },
      names: { dns: ["ruled.internal.ncfritz.net"] },
    };

    beforeAll(async () => {
      x509.cryptoProvider.set(webcrypto as unknown as Crypto);
      await create({ id: "ruled", description: "Ruled", ...rules }).expect(201);
    });

    it("builds the subject from its rules and gives the default usages", async () => {
      const certificate = parsed(
        await ask({
          ...base,
          subject: {
            ...base.subject,
            attributes: [
              ...base.subject.attributes,
              { type: "title", value: "ops" },
            ],
          },
        }).expect(201),
      );
      const subject = certificate.subjectName;
      expect(subject.getField("C")).toEqual(["US"]);
      expect(subject.getField("ST")).toEqual(["Oregon"]);
      expect(subject.getField("2.5.4.12")).toEqual(["ops"]);
      expect(subject.getField("CN")).toEqual(["ruled"]);
      expect(subject.getField("O")).toEqual([]);
      expect(usages(certificate)).toEqual({
        ku:
          x509.KeyUsageFlags.digitalSignature |
          x509.KeyUsageFlags.nonRepudiation,
        eku: [OID.clientAuth],
      });
    });

    it("lets a request drop a default and add an optional usage", async () => {
      const certificate = parsed(
        await ask({
          ...base,
          subject: { ...base.subject, commonName: "chosen" },
          keyUsages: ["key_agreement"],
          extendedKeyUsages: [OID.serverAuth],
        }).expect(201),
      );
      expect(usages(certificate)).toEqual({
        ku:
          x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyAgreement,
        eku: [OID.clientAuth, OID.serverAuth],
      });
    });

    it("refuses what the rules refuse", async () => {
      const refused = async (body: object, message: RegExp) =>
        expect(
          (await ask({ ...base, ...body }).expect(422)).body.message,
        ).toMatch(message);
      await refused({ subject: { commonName: "x" } }, /the subject needs ST/);
      await refused(
        { subject: { ...base.subject, organization: "elsewhere" } },
        /may not hold O/,
      );
      await refused(
        {
          subject: {
            ...base.subject,
            attributes: [
              ...base.subject.attributes,
              { type: "C", value: "GB" },
            ],
          },
        },
        /C is fixed at US/,
      );
      await refused(
        {
          subject: {
            ...base.subject,
            attributes: [
              ...base.subject.attributes,
              { type: "title", value: "Ops!" },
            ],
          },
        },
        /does not match/,
      );
      await refused(
        { names: { dns: ["host.example.com"] } },
        /outside the permitted dns subtrees/,
      );
      await refused(
        { names: { dns: ["a.secret.internal.ncfritz.net"] } },
        /excluded subtree/,
      );
      await refused(
        { names: { ip: ["192.168.15.4"] } },
        /needs at least one dns name/,
      );
      await refused({ keyUsages: ["crl_sign"] }, /excludes the key usage/);
      await refused({ keyAlgorithm: "RSA-2048" }, /allows P-256, P-384 keys/);
    });

    it("takes a CSR only signed with an allowed hash, and its asked-for usages", async () => {
      const csrOf = async (hash: string, curve: string) => {
        const algorithm = { name: "ECDSA", namedCurve: curve, hash };
        const keys = (await webcrypto.subtle.generateKey(algorithm, true, [
          "sign",
          "verify",
        ])) as CryptoKeyPair;
        return (
          await x509.Pkcs10CertificateRequestGenerator.create({
            name: "CN=ignored",
            keys,
            signingAlgorithm: algorithm,
            extensions: [
              new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.digitalSignature |
                  x509.KeyUsageFlags.keyAgreement |
                  x509.KeyUsageFlags.cRLSign,
              ),
            ],
          })
        ).toString("pem");
      };
      const sha256 = await ask({
        ...base,
        csr: await csrOf("SHA-256", "P-256"),
      }).expect(422);
      expect(sha256.body.message).toMatch(/signed with sha384, not sha256/);
      const certificate = parsed(
        await ask({
          ...base,
          subject: { ...base.subject, commonName: "from-csr" },
          csr: await csrOf("SHA-384", "P-384"),
        }).expect(201),
      );
      // The CSR's crlSign is excluded, so passed over; keyAgreement is optional.
      expect(usages(certificate).ku).toBe(
        x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyAgreement,
      );
    });

    it("refuses a version whose rules do not hold together", async () => {
      const refused = await create({
        id: "unruly",
        description: "x",
        ...rules,
        keyAlgorithm: "RSA-2048",
        minNames: 2,
        names: [],
        namePolicy: [{ type: "ip", kind: "permitted", value: "10.0.0.1" }],
        subjectAttributes: [
          { attribute: "C", presence: "required", locked: true, maxCount: 1 },
          {
            attribute: "ST",
            presence: "optional",
            locked: false,
            defaultValue: "oregon",
            pattern: "[A-Z][a-z]+",
            maxCount: 1,
          },
          {
            attribute: "nonsense",
            presence: "optional",
            locked: false,
            maxCount: 1,
          },
        ],
      }).expect(422);
      for (const problem of [
        /C is locked with no value/,
        /ST's default "oregon" does not match/,
        /nonsense is not a subject attribute/,
        /needs 2 names but allows no name type/,
        /10.0.0.1 is not an IP network/,
        /default key type RSA-2048 is not among/,
      ]) {
        expect(refused.body.message).toMatch(problem);
      }
    });
  });

  describe("certificate settings", () => {
    /** "olympus", a UTF8String: a custom extension's value. */
    const CUSTOM = Buffer.from([0x0c, 0x07, ...Buffer.from("olympus")]);
    const custom = {
      oid: "1.3.6.1.4.1.55555.1.1",
      critical: false,
      value: CUSTOM.toString("base64"),
    };
    const configured = {
      ...settings,
      names: [
        { type: "dns", presence: "allowed" },
        { type: "upn", presence: "allowed" },
        { type: "registeredId", presence: "allowed" },
      ],
      signatureHash: "sha384",
      subjectKeyIdentifier: "sha256",
      authorityKeyIdentifier: "key_id_and_issuer",
      basicConstraints: "non_critical",
      includeCrlDistribution: false,
      includeIssuerAltName: true,
      policies: [
        {
          oid: "1.3.6.1.4.1.55555.2.1",
          cpsUri: "https://pki.internal.ncfritz.net/cps",
          userNotice: "Internal use only",
        },
        { oid: "2.23.140.1.2.1" },
      ],
      customExtensions: [custom],
    };

    beforeAll(async () => {
      x509.cryptoProvider.set(webcrypto as unknown as Crypto);
    });

    it("gives the CA its alternative names, an admin's after a recent sign-in", async () => {
      const issuerId = hierarchy.issuing.Service.id;
      const names = {
        email: ["pki@ncfritz.net"],
        uri: ["https://pki.internal.ncfritz.net/"],
      };
      await request(server())
        .put(`/v1/issuer/${issuerId}`)
        .set("Authorization", harness.operator)
        .send({ alternativeNames: names })
        .expect(403);
      await request(server())
        .put(`/v1/issuer/${issuerId}`)
        .set("Authorization", harness.admin)
        .send({ alternativeNames: { email: ["not an address"] } })
        .expect(422);
      const response = await request(server())
        .put(`/v1/issuer/${issuerId}`)
        .set("Authorization", harness.admin)
        .send({ alternativeNames: names })
        .expect(200);
      expect(
        (response.body as { issuer: { alternativeNames: object } }).issuer
          .alternativeNames,
      ).toEqual(names);
      const audited = await harness.prisma.auditEvent.findMany({
        where: { kind: "issuer.updated", subjectId: issuerId },
      });
      expect(audited).toHaveLength(1);
    });

    it("issues what the version says, and renews the same", async () => {
      await create({
        id: "configured",
        description: "Configured",
        ...configured,
      }).expect(201);
      const issued = await request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.operator)
        .send({
          profileId: "configured",
          subject: { commonName: "configured" },
          names: {
            dns: ["configured.internal.ncfritz.net"],
            upn: ["neil@ncfritz.net"],
            registeredId: ["1.3.6.1.4.1.55555.3"],
          },
        })
        .expect(201);
      const body = issued.body as {
        certificate: { id: string; certificate: string };
      };
      for (const pem of [
        body.certificate.certificate,
        (await renew(body.certificate.id)).certificate,
      ]) {
        const certificate = new x509.X509Certificate(pem);
        expect(certificate.signatureAlgorithm).toMatchObject({
          name: "ECDSA",
          hash: { name: "SHA-384" },
        });
        const constraints = certificate.getExtension(
          x509.BasicConstraintsExtension,
        );
        expect(constraints?.critical).toBe(false);
        expect(constraints?.ca).toBe(false);
        const ski = certificate.getExtension(
          x509.SubjectKeyIdentifierExtension,
        )?.keyId;
        expect(ski).toBe(
          createHash("sha256")
            .update(
              subjectPublicKeyBits(Buffer.from(certificate.publicKey.rawData)),
            )
            .digest()
            .subarray(0, 20)
            .toString("hex"),
        );
        const aki = certificate.getExtension(
          x509.AuthorityKeyIdentifierExtension,
        );
        expect(aki?.certId?.serialNumber).toBeTruthy();
        expect(
          certificate.getExtension("2.5.29.31" /* CRL distribution */),
        ).toBeNull();
        expect(
          certificate.getExtension("1.3.6.1.5.5.7.1.1" /* AIA */),
        ).not.toBeNull();
        const ian = certificate.getExtension("2.5.29.18");
        expect(ian).not.toBeNull();
        const policies = certificate.getExtension(
          x509.CertificatePolicyExtension,
        );
        expect(policies?.policies).toEqual([
          "1.3.6.1.4.1.55555.2.1",
          "2.23.140.1.2.1",
        ]);
        const extension = certificate.getExtension(custom.oid);
        expect(Buffer.from(extension!.value)).toEqual(CUSTOM);
        const sans = certificate.getExtension(
          x509.SubjectAlternativeNameExtension,
        );
        const types = sans?.names.items.map((n) => n.type).sort();
        expect(types).toEqual(["dns", "id", "upn"]);
      }
    });

    it("refuses a version's extensions that are not its to make", async () => {
      const refused = await create({
        id: "overreaching",
        description: "x",
        ...configured,
        customExtensions: [
          { oid: "2.5.29.19", critical: true, value: "MAA=" },
          { ...custom, value: Buffer.from([0x05]).toString("base64") },
        ],
        policies: [{ oid: "2.23.140.1.2.1", cpsUri: "ftp://nowhere" }],
      }).expect(422);
      for (const problem of [
        /2.5.29.19 \(basic constraints\) is not a custom extension/,
        /value is not one DER element/,
        /CPS URI ftp:\/\/nowhere is not an http\(s\) URL/,
      ]) {
        expect(refused.body.message).toMatch(problem);
      }
      const minimal = await create({
        id: "minimal-overreaching",
        description: "x",
        ...configured,
        extensions: "minimal",
      }).expect(422);
      expect(minimal.body.message).toMatch(
        /minimal extensions carry only the key identifiers/,
      );
      await create({
        id: "policed-upn",
        description: "x",
        ...settings,
        namePolicy: [{ type: "upn", kind: "permitted", value: "ncfritz.net" }],
      }).expect(400);
    });
  });
});
