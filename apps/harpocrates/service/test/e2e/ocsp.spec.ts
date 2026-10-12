import { execFileSync, spawn, spawnSync } from "child_process";
import type { AddressInfo } from "net";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CrlScheduler } from "../../src/crls/services/CrlScheduler";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  EXPORT_PASSPHRASE,
  type Hierarchy,
  makeCsr,
  RECOVERY_PASSPHRASE,
  startHarness,
  type Harness,
} from "../support/e2e";

const hasOpenssl = spawnSync("openssl", ["version"]).error === undefined;
const DAY = 24 * 60 * 60 * 1000;

type Responder = {
  id: string;
  issuerId: string;
  serial: string;
  notBefore: string;
  notAfter: string;
  status: string;
  ceremonyId?: string;
  certificate: string;
};

/**
 * OCSP in the service (ADR 0036, phase 11 step 2): online CAs' responders
 * issued and renewed by the scheduler, an offline CA's in a ceremony, and
 * every certificate's responses signed ahead, re-signed on a revocation,
 * and kept while the signer is sealed. Each response is checked by
 * `openssl ocsp` as a client would check it.
 */
describe.skipIf(!E2E_DATABASE_URL)("ocsp", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let scheduler: CrlScheduler;
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
      ).body as {
        certificate: { id: string; serial: string; certificate: string };
      }
    ).certificate;
  };

  const revoke = (certificateId: string, reason = "keyCompromise") =>
    request(server())
      .post(`/v1/certificate/${certificateId}/revoke`)
      .set("Authorization", harness.operator)
      .send({ reason })
      .expect(200);

  const responders = async (issuerId: string) =>
    (
      await request(server())
        .get(`/v1/issuer/${issuerId}/ocsp-responders`)
        .set("Authorization", harness.operator)
        .expect(200)
    ).body as {
      responders: Responder[];
      responses: {
        count: number;
        revoked: number;
        earliestNextUpdate?: string;
      };
    };

  const stored = (
    issuerId: string,
    serial: string,
    hash: "sha1" | "sha256" = "sha1",
  ) =>
    harness.prisma.ocspResponse.findUniqueOrThrow({
      where: { issuerId_serial_hash: { issuerId, serial, hash } },
    });

  /** What `openssl ocsp` makes of a stored response for a certificate. */
  const check = (
    der: Uint8Array,
    issuerPem: string,
    certificatePem: string,
    trusted: string[],
  ) => {
    const dir = fs.mkdtempSync(path.join(harness.dir, "ocsp-"));
    const write = (name: string, content: string | Uint8Array) => {
      fs.writeFileSync(path.join(dir, name), content);
      return path.join(dir, name);
    };
    const result = spawnSync(
      "openssl",
      [
        "ocsp",
        "-respin",
        write("response.der", der),
        "-issuer",
        write("issuer.pem", issuerPem),
        "-cert",
        write("certificate.pem", certificatePem),
        "-CAfile",
        write("trusted.pem", trusted.join("")),
      ],
      { encoding: "utf8" },
    );
    return { out: result.stdout, err: result.stderr };
  };

  beforeAll(async () => {
    harness = await startHarness();
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
    ]);
    scheduler = harness.app.get(CrlScheduler);
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("issues an online CA's responder on the first run, valid 30 days", async () => {
    const run = await scheduler.run();
    expect(run.ocsp.failed).toEqual([]);
    expect(run.ocsp.responders).toEqual([
      { issuerId: tls, serial: expect.stringMatching(/^[0-9a-f]+$/) },
    ]);
    const { responders: list } = await responders(tls);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: "active", issuerId: tls });
    expect(list[0].ceremonyId).toBeUndefined();
    const days =
      (Date.parse(list[0].notAfter) - Date.parse(list[0].notBefore)) / DAY;
    expect(Math.round(days)).toBe(30);
    const key = await harness.prisma.key.findFirstOrThrow({
      where: { ocspResponder: { id: list[0].id } },
    });
    expect(key).toMatchObject({ purpose: "ocsp", location: "signer" });
    expect(
      await harness.prisma.auditEvent.count({
        where: { kind: "ocsp-responder.issued", subjectId: list[0].id },
      }),
    ).toBe(1);
    // Nothing more to do on the next run.
    const again = await scheduler.run();
    expect(again.ocsp.responders).toEqual([]);
  });

  it("signs a response for each certificate, by either CertID hash, and none again while fresh", async () => {
    const certificate = await issue("ocsp-good.internal.ncfritz.net");
    const run = await scheduler.run();
    expect(run.ocsp.responses).toEqual([
      expect.objectContaining({ issuerId: tls }),
    ]);
    const response = await stored(tls, certificate.serial);
    expect(response).toMatchObject({ status: "good", revokedAt: null });
    expect(response.nextUpdate.getTime() - response.thisUpdate.getTime()).toBe(
      4 * DAY,
    );
    await stored(tls, certificate.serial, "sha256");
    if (hasOpenssl) {
      const { out, err } = check(
        response.der,
        hierarchy.issuing.TLS.certificate,
        certificate.certificate,
        [hierarchy.root.certificate, hierarchy.intermediate.certificate],
      );
      expect(err).toMatch(/Response verify OK/);
      expect(out).toMatch(/certificate\.pem: good/);
    }
    const again = await scheduler.run();
    expect(again.ocsp.responses).toEqual([]);
  });

  it("re-signs a revoked certificate's response at once", async () => {
    const certificate = await issue("ocsp-revoked.internal.ncfritz.net");
    await scheduler.run();
    await revoke(certificate.id);
    // The revocation kicks the scheduler; run it here to know when it is done.
    const run = await scheduler.run();
    expect(run.ocsp.responses).toEqual([
      // Its two responses; the rest are fresh.
      { issuerId: tls, signed: 2 },
    ]);
    const response = await stored(tls, certificate.serial);
    expect(response).toMatchObject({
      status: "revoked",
      reason: "keyCompromise",
    });
    expect(response.thisUpdate.getTime()).toBeGreaterThanOrEqual(
      response.revokedAt!.getTime(),
    );
    if (hasOpenssl) {
      const { out, err } = check(
        response.der,
        hierarchy.issuing.TLS.certificate,
        certificate.certificate,
        [hierarchy.root.certificate, hierarchy.intermediate.certificate],
      );
      expect(err).toMatch(/Response verify OK/);
      expect(out).toMatch(/certificate\.pem: revoked/);
      expect(out).toMatch(/Reason: keyCompromise/);
    }
    expect((await responders(tls)).responses.revoked).toBe(2);
  });

  it("keeps serving stored responses while the signer is sealed", async () => {
    const certificate = await issue("ocsp-sealed.internal.ncfritz.net");
    await request(server())
      .post("/v1/signer/seal")
      .set("Authorization", harness.admin)
      .expect(204);
    const sealed = await scheduler.run();
    expect(sealed.ocsp.failed).toEqual([
      expect.objectContaining({ issuerId: tls, reason: "sealed" }),
    ]);
    // What was signed before is still there.
    expect((await responders(tls)).responses.count).toBeGreaterThan(0);
    await request(server())
      .post("/v1/signer/unseal")
      .set("Authorization", harness.admin)
      .send({ passphrase: RECOVERY_PASSPHRASE })
      .expect(204);
    await scheduler.run();
    expect(await stored(tls, certificate.serial)).toMatchObject({
      status: "good",
    });
  });

  it("renews a responder 10 days before it lapses, re-signs with the new one, and destroys the old key once it expires", async () => {
    const [old] = (await responders(tls)).responders;
    await harness.prisma.ocspResponder.update({
      where: { id: old.id },
      data: { notAfter: new Date(Date.now() + 9 * DAY) },
    });
    const renewed = await scheduler.run();
    expect(renewed.ocsp.responders).toHaveLength(1);
    const list = (await responders(tls)).responders;
    expect(list.map((r) => r.status)).toEqual(["active", "superseded"]);
    const fresh = list[0];
    const signedBy = await harness.prisma.ocspResponse.findMany({
      where: { issuerId: tls },
      select: { responderId: true },
    });
    expect(new Set(signedBy.map((r) => r.responderId))).toEqual(
      new Set([fresh.id]),
    );

    await harness.prisma.ocspResponder.update({
      where: { id: old.id },
      data: { notAfter: new Date(Date.now() - 1000) },
    });
    const retired = await scheduler.run();
    expect(retired.ocsp.retired).toEqual([old.id]);
    const key = await harness.prisma.key.findFirstOrThrow({
      where: { ocspResponder: { id: old.id } },
    });
    expect(key.destroyedAt).not.toBeNull();
  });

  it("issues an offline CA's responder in a ceremony, and signs its responses at once", async () => {
    const ceremony = (
      (
        await request(server())
          .post("/v1/ceremonies")
          .set("Authorization", harness.admin)
          .send({
            issuerId: hierarchy.intermediate.id,
            privateKey: hierarchy.intermediate.encryptedKey,
            passphrase: EXPORT_PASSPHRASE,
          })
          .expect(201)
      ).body as { ceremony: { id: string } }
    ).ceremony.id;
    await request(server())
      .post(`/v1/ceremony/${ceremony}/ocsp-responder`)
      .set("Authorization", harness.operator)
      .expect(403);
    const issued = await request(server())
      .post(`/v1/ceremony/${ceremony}/ocsp-responder`)
      .set("Authorization", harness.admin)
      .expect(201);
    expect(issued.headers.location).toMatch(
      new RegExp(`/issuer/${hierarchy.intermediate.id}/ocsp-responders$`),
    );
    const responder = (issued.body as { responder: Responder }).responder;
    expect(responder).toMatchObject({
      issuerId: hierarchy.intermediate.id,
      ceremonyId: ceremony,
      status: "active",
    });
    const days =
      (Date.parse(responder.notAfter) - Date.parse(responder.notBefore)) / DAY;
    expect(Math.round(days)).toBe(395);
    await request(server())
      .delete(`/v1/ceremony/${ceremony}`)
      .set("Authorization", harness.admin)
      .expect(204);

    // The issuing CA's certificate is answered for, the intermediate's key
    // offline again.
    const issuing = await harness.prisma.issuer.findUniqueOrThrow({
      where: { id: tls },
    });
    const response = await stored(hierarchy.intermediate.id, issuing.serial!);
    expect(response.status).toBe("good");
    if (hasOpenssl) {
      const { out, err } = check(
        response.der,
        hierarchy.intermediate.certificate,
        hierarchy.issuing.TLS.certificate,
        [hierarchy.root.certificate],
      );
      expect(err).toMatch(/Response verify OK/);
      expect(out).toMatch(/certificate\.pem: good/);
      const text = execFileSync("openssl", ["x509", "-noout", "-text"], {
        input: responder.certificate,
        encoding: "utf8",
      });
      expect(text).toMatch(/OCSP No Check/);
      expect(text).toMatch(/OCSP Signing/);
    }
  });

  describe("the responder at /ocsp", () => {
    let base: string;
    let good: { id: string; serial: string; certificate: string };
    let revoked: { id: string; serial: string; certificate: string };
    let work: string;
    const issuingFile = () => path.join(work, "issuing.pem");
    const trustedFile = () => path.join(work, "trusted.pem");

    /** openssl ocsp's request for a certificate, as DER. */
    const ask = (certificatePem: string, ...flags: string[]) => {
      const certificate = path.join(work, `ask-${Date.now()}.pem`);
      const out = `${certificate}.der`;
      fs.writeFileSync(certificate, certificatePem);
      execFileSync("openssl", [
        "ocsp",
        "-issuer",
        issuingFile(),
        ...flags,
        "-cert",
        certificate,
        "-reqout",
        out,
      ]);
      return fs.readFileSync(out);
    };

    /** What openssl reads in a response body, unverified. */
    const read = (body: Buffer) => {
      const file = path.join(work, `read-${Date.now()}.der`);
      fs.writeFileSync(file, body);
      const out = spawnSync(
        "openssl",
        ["ocsp", "-respin", file, "-resp_text", "-noverify"],
        { encoding: "utf8" },
      );
      return out.stdout + out.stderr;
    };

    /** openssl ocsp as a client: it asks the URL, then verifies. */
    const client = (certificatePem: string) =>
      new Promise<string>((resolve, reject) => {
        const certificate = path.join(work, `client-${Date.now()}.pem`);
        fs.writeFileSync(certificate, certificatePem);
        // Apart from this process, which serves the request.
        const child = spawn("openssl", [
          "ocsp",
          "-issuer",
          issuingFile(),
          "-cert",
          certificate,
          "-CAfile",
          trustedFile(),
          "-url",
          `${base}/ocsp`,
        ]);
        let out = "";
        child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
        child.stderr.on("data", (chunk: Buffer) => (out += chunk.toString()));
        child.on("error", reject);
        child.on("close", () => resolve(out));
      });

    beforeAll(async () => {
      work = fs.mkdtempSync(path.join(harness.dir, "responder-"));
      fs.writeFileSync(issuingFile(), hierarchy.issuing.TLS.certificate);
      fs.writeFileSync(
        trustedFile(),
        hierarchy.root.certificate + hierarchy.intermediate.certificate,
      );
      const listening = harness.app.getHttpServer();
      await new Promise<void>((resolve) =>
        listening.listen(0, "127.0.0.1", resolve),
      );
      base = `http://127.0.0.1:${(listening.address() as AddressInfo).port}`;
      good = await issue("responder-good.internal.ncfritz.net");
      revoked = await issue("responder-revoked.internal.ncfritz.net");
      await revoke(revoked.id, "superseded");
      await scheduler.run();
    });

    it.skipIf(!hasOpenssl)(
      "answers openssl's POST, verified to the root",
      async () => {
        const out = await client(good.certificate);
        expect(out).toMatch(/Response verify OK/);
        expect(out).toMatch(/: good/);
        const revokedOut = await client(revoked.certificate);
        expect(revokedOut).toMatch(/Response verify OK/);
        expect(revokedOut).toMatch(/: revoked/);
        expect(revokedOut).toMatch(/Reason: superseded/);
      },
    );

    it.skipIf(!hasOpenssl)(
      "answers a GET as a cache should keep it, and a POST the same",
      async () => {
        const der = ask(good.certificate, "-no_nonce");
        const got = await request(server())
          .get(`/ocsp/${encodeURIComponent(der.toString("base64"))}`)
          .buffer(true)
          .parse((res, done) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => done(null, Buffer.concat(chunks)));
          })
          .expect(200)
          .expect("Content-Type", "application/ocsp-response");
        const body = got.body as Buffer;
        expect(read(body)).toMatch(/Cert Status: good/);
        expect(got.headers["cache-control"]).toMatch(
          /^max-age=\d+, public, no-transform, must-revalidate$/,
        );
        const maxAge = Number(
          /max-age=(\d+)/.exec(got.headers["cache-control"])![1],
        );
        // 4 days, less an hour's margin, less the time since it was signed.
        expect(maxAge).toBeGreaterThan(3 * 24 * 3600);
        expect(maxAge).toBeLessThanOrEqual(4 * 24 * 3600 - 3600);
        expect(got.headers.etag).toMatch(/^"[0-9a-f]{40}"$/);
        expect(Date.parse(got.headers.expires)).toBeGreaterThan(Date.now());
        expect(got.headers["last-modified"]).toBeDefined();

        const posted = await request(server())
          .post("/ocsp")
          .set("Content-Type", "application/ocsp-request")
          .send(ask(good.certificate, "-sha256"))
          .buffer(true)
          .parse((res, done) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => done(null, Buffer.concat(chunks)));
          })
          .expect(200);
        expect(read(posted.body as Buffer)).toMatch(/Hash Algorithm: sha256/);
      },
    );

    it.skipIf(!hasOpenssl)(
      "is unauthorized for what it does not know, and malformed for what is not a request",
      async () => {
        const raw = (body: Buffer) =>
          request(server())
            .post("/ocsp")
            .set("Content-Type", "application/ocsp-request")
            .send(body)
            .buffer(true)
            .parse((res, done) => {
              const chunks: Buffer[] = [];
              res.on("data", (c: Buffer) => chunks.push(c));
              res.on("end", () => done(null, Buffer.concat(chunks)));
            })
            .expect(200);
        // A serial the CA never issued: the issuing CA's own, asked of itself.
        const unknown = await raw(ask(hierarchy.issuing.TLS.certificate));
        expect(read(unknown.body as Buffer)).toMatch(/unauthorized \(6\)/);
        expect(unknown.headers["cache-control"]).toBe("no-cache, no-store");
        const nonsense = await raw(Buffer.from("not an OCSP request"));
        expect(read(nonsense.body as Buffer)).toMatch(
          /malformedrequest \(1\)/i,
        );
      },
    );

    it.skipIf(!hasOpenssl)(
      "says try later once a response has lapsed",
      async () => {
        await harness.prisma.ocspResponse.updateMany({
          where: { issuerId: tls, serial: good.serial },
          data: { nextUpdate: new Date(Date.now() - 1000) },
        });
        const lapsed = await request(server())
          .post("/ocsp")
          .set("Content-Type", "application/ocsp-request")
          .send(ask(good.certificate))
          .buffer(true)
          .parse((res, done) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => done(null, Buffer.concat(chunks)));
          })
          .expect(200);
        expect(read(lapsed.body as Buffer)).toMatch(/trylater \(3\)/i);
      },
    );
  });

  it("answers 404 for a CA it does not know", async () => {
    await request(server())
      .get("/v1/issuer/no-such-ca/ocsp-responders")
      .set("Authorization", harness.operator)
      .expect(404);
  });
});
