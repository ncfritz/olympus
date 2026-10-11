import "reflect-metadata";
import * as x509 from "@peculiar/x509";
import { X509Certificate } from "crypto";
import * as fs from "fs";
import * as https from "https";
import type { Server } from "https";
import * as os from "os";
import * as path from "path";
import type { TLSSocket } from "tls";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CertificateRenewer, renewalDue } from "../../src/renewal";
import type { ClientTlsOptions } from "../../src/tls";
import { devCaFile } from "../support/devCa";

type Seen = { caller?: string; body: { csr?: string } };

/**
 * A service's certificate renewing itself against a stand-in for
 * Harpocrates's renewal listener: when it is due, what it presents, what
 * it writes, and a new key when the old one is too old.
 */
describe("CertificateRenewer", () => {
  let server: Server;
  let url: string;
  const seen: Seen[] = [];
  /** What the listener answers next. */
  let answers: { status: number; body: unknown }[] = [];
  let dir: string;
  let tls: ClientTlsOptions & { renewal: { url: string; ca: string } };
  const quiet = { log: () => {}, warn: () => {} };

  const renewal = (name: string) => ({
    certificate: {
      certificate: fs.readFileSync(devCaFile(`agents/${name}.crt`), "utf8"),
      chain: [fs.readFileSync(devCaFile("services-ca.crt"), "utf8")],
    },
  });

  beforeAll(async () => {
    server = https.createServer(
      {
        cert: fs.readFileSync(devCaFile("api.crt")),
        key: fs.readFileSync(devCaFile("api.key")),
        requestCert: true,
        rejectUnauthorized: false,
      },
      (request, response) => {
        let text = "";
        request.on("data", (chunk: Buffer) => (text += chunk.toString()));
        request.on("end", () => {
          const name = (request.socket as TLSSocket).getPeerCertificate()
            .subject?.CN;
          seen.push({
            caller: Array.isArray(name) ? name[0] : name,
            body: JSON.parse(text) as Seen["body"],
          });
          const answer = answers.shift() ?? { status: 500, body: {} };
          response.writeHead(answer.status, {
            "content-type": "application/json",
          });
          response.end(JSON.stringify(answer.body));
        });
      },
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    url = `https://localhost:${(server.address() as { port: number }).port}`;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "renewer-"));
    tls = {
      certificate: path.join(dir, "client.crt"),
      key: path.join(dir, "client.key"),
      renewal: { url, ca: devCaFile("services-ca.crt") },
    };
    fs.copyFileSync(
      devCaFile("agents/dionysus-search-agent.crt"),
      tls.certificate,
    );
    fs.copyFileSync(devCaFile("agents/dionysus-search-agent.key"), tls.key);
    seen.length = 0;
    answers = [];
  });

  const certificate = () =>
    new X509Certificate(fs.readFileSync(tls.certificate));

  it("waits until two-thirds of the certificate's life", async () => {
    const renewer = new CertificateRenewer(tls, quiet);
    const cert = certificate();
    const due = renewalDue(new Date(cert.validFrom), new Date(cert.validTo));
    expect(renewer.due()).toEqual(due);
    expect(await renewer.check(new Date(due.getTime() - 1000))).toBe("not-due");
    expect(seen).toEqual([]);
  });

  it("presents itself and writes the renewal over its file, keeping the key", async () => {
    const key = fs.readFileSync(tls.key, "utf8");
    answers = [{ status: 201, body: renewal("dionysus-metadata-agent") }];
    const renewer = new CertificateRenewer(tls, quiet);
    expect(await renewer.check(new Date("2999-01-01"))).toBe("renewed");
    expect(seen).toEqual([{ caller: "dionysus-search-agent", body: {} }]);
    expect(certificate().subject).toContain("CN=dionysus-metadata-agent");
    // The chain follows the certificate in the file.
    const issued = renewal("dionysus-metadata-agent").certificate;
    expect(fs.readFileSync(tls.certificate, "utf8")).toBe(
      [issued.certificate, ...issued.chain].join(""),
    );
    expect(fs.readFileSync(tls.key, "utf8")).toBe(key);
  });

  it("makes a new key, with a CSR for the same subject, when the old one is too old", async () => {
    const key = fs.readFileSync(tls.key, "utf8");
    answers = [
      {
        status: 422,
        body: {
          message:
            "The key is older than the profile's 730 days: renew with a CSR for a new key",
        },
      },
      { status: 201, body: renewal("dionysus-search-agent") },
    ];
    const renewer = new CertificateRenewer(tls, quiet);
    expect(await renewer.check(new Date("2999-01-01"))).toBe("rekeyed");
    expect(seen).toHaveLength(2);
    const csr = new x509.Pkcs10CertificateRequest(seen[1].body.csr!);
    expect(csr.subject).toContain("CN=dionysus-search-agent");
    expect(await csr.verify()).toBe(true);
    expect(fs.readFileSync(tls.key, "utf8")).not.toBe(key);
    expect((fs.statSync(tls.key).mode & 0o777).toString(8)).toBe("600");
  });

  it("keeps what it has when renewal is refused", async () => {
    const before = fs.readFileSync(tls.certificate, "utf8");
    answers = [{ status: 401, body: { message: "revoked" } }];
    const renewer = new CertificateRenewer(tls, quiet);
    expect(await renewer.check(new Date("2999-01-01"))).toBe("failed");
    expect(fs.readFileSync(tls.certificate, "utf8")).toBe(before);
  });
});
