import { execFileSync, spawnSync } from "child_process";
import { X509Certificate } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  certIdHashes,
  OcspResponseStatus,
  parseOcspRequest,
  unsignedOcspResponse,
} from "../../../src/pki/ocsp";

const hasOpenssl = spawnSync("openssl", ["version"]).error === undefined;

/** OCSP's wire, checked against what openssl asks and reads. */
describe.skipIf(!hasOpenssl)("ocsp", () => {
  let dir: string;
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { encoding: "utf8", stdio: "pipe" });
  const file = (name: string) => path.join(dir, name);

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hrp-ocsp-"));
    openssl(
      "req",
      "-x509",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-nodes",
      "-keyout",
      file("ca.key"),
      "-out",
      file("ca.pem"),
      "-subj",
      "/CN=Test Issuing CA 1 - G1/O=Olympus Test",
      "-days",
      "30",
    );
    for (const [name, serial] of [
      ["leaf", "0x00f1e2d3c4b5a6978877"],
      ["other", "0x1234"],
    ]) {
      openssl(
        "req",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:P-256",
        "-nodes",
        "-keyout",
        file(`${name}.key`),
        "-out",
        file(`${name}.csr`),
        "-subj",
        `/CN=${name}.localhost`,
      );
      openssl(
        "x509",
        "-req",
        "-in",
        file(`${name}.csr`),
        "-CA",
        file("ca.pem"),
        "-CAkey",
        file("ca.key"),
        "-set_serial",
        serial,
        "-days",
        "10",
        "-out",
        file(`${name}.pem`),
      );
    }
  });

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const request = (...args: string[]) => {
    const out = file(`request-${args.join("-").replace(/\W/g, "")}.der`);
    openssl("ocsp", "-issuer", file("ca.pem"), ...args, "-reqout", out);
    return fs.readFileSync(out);
  };

  it.each([
    ["sha1", []],
    ["sha256", ["-sha256"]],
  ] as const)(
    "reads a %s CertID openssl asks with, nonce and all",
    (hash, flags) => {
      const asked = parseOcspRequest(
        request(...flags, "-cert", file("leaf.pem")),
      );
      const ca = new X509Certificate(fs.readFileSync(file("ca.pem")));
      const leaf = new X509Certificate(fs.readFileSync(file("leaf.pem")));
      expect(asked).toEqual({
        hash,
        ...certIdHashes(ca.raw, hash),
        serial: leaf.serialNumber.toLowerCase().replace(/^0+/, ""),
      });
      expect(asked.serial).toBe("f1e2d3c4b5a6978877");
    },
  );

  it("refuses a request for two certificates, or what is not one", () => {
    expect(() =>
      parseOcspRequest(
        request("-cert", file("leaf.pem"), "-cert", file("other.pem")),
      ),
    ).toThrow(/more than one/);
    expect(() => parseOcspRequest(Buffer.from("not DER"))).toThrow();
    const good = request("-no_nonce", "-cert", file("other.pem"));
    expect(parseOcspRequest(good).serial).toBe("1234");
    expect(() => parseOcspRequest(good.subarray(0, good.length - 3))).toThrow(
      /truncated/,
    );
    expect(() =>
      parseOcspRequest(Buffer.concat([good, Buffer.from([0])])),
    ).toThrow(/bytes after/);
  });

  it("writes a status-only response openssl reads", () => {
    const out = file("unauthorized.der");
    fs.writeFileSync(
      out,
      unsignedOcspResponse(OcspResponseStatus.unauthorized),
    );
    const read = spawnSync(
      "openssl",
      ["ocsp", "-respin", out, "-resp_text", "-noverify"],
      { encoding: "utf8" },
    );
    expect(read.stdout + read.stderr).toMatch(/unauthorized \(6\)/);
  });
});
