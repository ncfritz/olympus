import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { E2E_DATABASE_URL, startHarness, type Harness } from "../support/e2e";

/**
 * An imported offline CA's ID corrected (ADR 0042): only while nothing it
 * signed names its URLs, never an issuing CA's, and everything that
 * references it follows.
 */
describe.skipIf(!E2E_DATABASE_URL)("an imported CA given another ID", () => {
  let harness: Harness;
  let dir: string;
  const server = () => harness.app.getHttpServer();
  const at = (name: string) => path.join(dir, name);
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { stdio: "pipe" });

  /** A CA as XCA makes one: its key, and its certificate signed by `by`. */
  const ca = (name: string, cn: string, by?: string, extra: string[] = []) => {
    fs.writeFileSync(
      at(`${name}.cnf`),
      [
        "basicConstraints = critical, CA:true",
        "keyUsage = critical, keyCertSign, cRLSign",
        "subjectKeyIdentifier = hash",
        ...(by ? ["authorityKeyIdentifier = keyid"] : []),
        ...extra,
      ].join("\n"),
    );
    openssl(
      "ecparam",
      "-name",
      "prime256v1",
      "-genkey",
      "-noout",
      "-out",
      at(`${name}.key`),
    );
    openssl(
      "req",
      "-new",
      "-key",
      at(`${name}.key`),
      "-subj",
      `/CN=${cn}/O=Olympus Rename Test`,
      "-out",
      at(`${name}.csr`),
    );
    openssl(
      "x509",
      "-req",
      "-in",
      at(`${name}.csr`),
      "-days",
      "365",
      ...(by
        ? ["-CA", at(`${by}.crt`), "-CAkey", at(`${by}.key`)]
        : ["-key", at(`${name}.key`)]),
      "-set_serial",
      `0x${Math.floor(Math.random() * 1e9).toString(16)}`,
      "-extfile",
      at(`${name}.cnf`),
      "-out",
      at(`${name}.crt`),
    );
    return fs.readFileSync(at(`${name}.crt`), "utf8");
  };

  const importIssuer = (body: object) =>
    request(server())
      .post("/v1/issuers/import")
      .set("Authorization", harness.admin)
      .send({ chain: [], maxValidityDays: 825, extendedKeyUsages: [], ...body })
      .expect(201);
  const rename = (issuerId: string, id: string, as = harness.admin) =>
    request(server())
      .post(`/v1/issuer/${issuerId}/rename`)
      .set("Authorization", as)
      .send({ id });

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "rename-"));
    harness = await startHarness();
  });

  afterAll(async () => {
    await harness?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("moves the CA and everything referencing it to the new ID", async () => {
    const root = ca("wrong", "Rename Root CA 1");
    await importIssuer({
      id: "wrong-slug",
      tier: "root",
      number: 1,
      generation: 1,
      certificate: root,
    });
    // A CA beneath it whose certificate names XCA's URLs, not its slug.
    const child = ca("child", "Rename Intermediate CA 1", "wrong", [
      "crlDistributionPoints = URI:http://xca.example/root.crl",
    ]);
    await importIssuer({
      id: "rename-intermediate-1-g1",
      tier: "intermediate",
      number: 1,
      generation: 1,
      certificate: child,
      chain: [root],
    });
    fs.mkdirSync(path.join(harness.published, "ca"), { recursive: true });
    fs.writeFileSync(path.join(harness.published, "ca", "wrong-slug.crt"), "");

    await rename("wrong-slug", "rename-root-1-g1", harness.operator).expect(
      403,
    );
    await rename("wrong-slug", "Not A Slug").expect(400);
    await rename("wrong-slug", "rename-intermediate-1-g1").expect(409);
    const renamed = await rename("wrong-slug", "rename-root-1-g1").expect(200);
    expect(renamed.body.issuer.id).toBe("rename-root-1-g1");
    expect(renamed.body.issuer.crlUrl).toMatch(/\/crl\/rename-root-1-g1\.crl$/);

    await request(server())
      .get("/v1/issuer/wrong-slug")
      .set("Authorization", harness.admin)
      .expect(404);
    const beneath = await harness.prisma.issuer.findUniqueOrThrow({
      where: { id: "rename-intermediate-1-g1" },
    });
    expect(beneath.parentId).toBe("rename-root-1-g1");
    expect(
      fs.existsSync(path.join(harness.published, "ca", "rename-root-1-g1.crt")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(harness.published, "ca", "wrong-slug.crt")),
    ).toBe(false);
    const event = await harness.prisma.auditEvent.findFirstOrThrow({
      where: { kind: "issuer.renamed" },
    });
    expect(event.subjectId).toBe("rename-root-1-g1");
  });

  it("keeps the ID while a certificate it signed names its URLs", async () => {
    const root = ca("named", "Rename Root CA 2");
    const imported = await importIssuer({
      id: "named-slug",
      tier: "root",
      number: 2,
      generation: 1,
      certificate: root,
    });
    const child = ca("named-child", "Rename Intermediate CA 2", "named", [
      `crlDistributionPoints = URI:${imported.body.issuer.crlUrl as string}`,
    ]);
    await importIssuer({
      id: "rename-intermediate-2-g1",
      tier: "intermediate",
      number: 2,
      generation: 1,
      certificate: child,
      chain: [root],
    });
    const refused = await rename("named-slug", "rename-root-2-g1").expect(409);
    expect(refused.body.message).toMatch(/rename-intermediate-2-g1/);
  });

  it("is refused for a CA made here, and for an issuing CA", async () => {
    await importIssuer({
      id: "third-slug",
      tier: "root",
      number: 3,
      generation: 1,
      certificate: ca("third", "Rename Root CA 3"),
    });
    // Standing in for a CA made here: one never imported.
    await harness.prisma.issuer.update({
      where: { id: "third-slug" },
      data: { importedAt: null },
    });
    await rename("third-slug", "rename-root-3-g1").expect(422);
    // And for an online CA, whose key the signer holds under its ID.
    await harness.prisma.issuer.update({
      where: { id: "third-slug" },
      data: { importedAt: new Date(), tier: "issuing" },
    });
    const refused = await rename("third-slug", "rename-root-3-g1").expect(422);
    expect(refused.body.message).toMatch(/signer/);
  });
});
