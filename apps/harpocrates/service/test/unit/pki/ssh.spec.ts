import { execFileSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildKrl,
  parseSshPublicKey,
  verifySshSignature,
} from "../../../src/pki/ssh";

const hasKeygen = spawnSync("ssh-keygen", ["-?"]).error === undefined;

/** OpenSSH's formats, checked against ssh-keygen itself. */
describe.skipIf(!hasKeygen)("ssh", () => {
  let dir: string;
  const keygen = (...args: string[]) =>
    execFileSync("ssh-keygen", args, { encoding: "utf8" });
  const key = (name: string, ...type: string[]) => {
    const file = path.join(dir, name);
    keygen("-q", "-N", "", "-C", name, "-f", file, ...type);
    return file;
  };

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hrp-ssh-"));
  });

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it.each([
    ["ed", ["-t", "ed25519"], "Ed25519"],
    ["ec", ["-t", "ecdsa", "-b", "384"], "P-384"],
    ["rsa", ["-t", "rsa", "-b", "3072"], "RSA-3072"],
  ])("reads an %s key as ssh-keygen does", (name, type, algorithm) => {
    const file = key(name, ...type);
    const line = fs.readFileSync(`${file}.pub`, "utf8");
    const parsed = parseSshPublicKey(line);
    expect(parsed.algorithm).toBe(algorithm);
    expect(keygen("-l", "-f", `${file}.pub`)).toContain(parsed.fingerprint);
    expect(parsed.spki.length).toBeGreaterThan(32);
  });

  it("refuses what is not a public key OpenSSH certifies", () => {
    expect(() => parseSshPublicKey("not a key")).toThrow();
    expect(() => parseSshPublicKey("ssh-ed25519 AAAA")).toThrow();
    const ed = fs.readFileSync(`${key("other", "-t", "ed25519")}.pub`, "utf8");
    expect(() =>
      parseSshPublicKey(ed.replace("ssh-ed25519", "ssh-rsa")),
    ).toThrow(/does not match/);
  });

  it("writes a KRL ssh-keygen reads, revoking by serial", () => {
    const ca = key("ca", "-t", "ed25519");
    const revoked = key("revoked", "-t", "ed25519");
    const kept = key("kept", "-t", "ed25519");
    keygen(
      "-q",
      "-s",
      ca,
      "-I",
      "r",
      "-n",
      "neil",
      "-z",
      "4242",
      `${revoked}.pub`,
    );
    keygen(
      "-q",
      "-s",
      ca,
      "-I",
      "k",
      "-n",
      "neil",
      "-z",
      "4343",
      `${kept}.pub`,
    );
    const krl = path.join(dir, "ca.krl");
    fs.writeFileSync(
      krl,
      buildKrl({
        caPublicKey: fs.readFileSync(`${ca}.pub`, "utf8"),
        serials: [4242n, 17n, 4242n],
        version: 3n,
        generatedAt: new Date(),
        comment: "test CA",
      }),
    );
    const query = (file: string) =>
      spawnSync("ssh-keygen", ["-Q", "-f", krl, `${file}-cert.pub`], {
        encoding: "utf8",
      });
    const out = query(revoked);
    expect(out.status).not.toBe(0);
    expect(out.stdout + out.stderr).toMatch(/REVOKED/);
    expect(query(kept).status).toBe(0);
    expect(keygen("-Q", "-l", "-f", krl)).toMatch(
      /# KRL version 3\n[\s\S]*serial: 17\n[\s\S]*serial: 4242/,
    );
  });

  it.each([
    ["signer-ed", ["-t", "ed25519"]],
    ["signer-ec", ["-t", "ecdsa", "-b", "521"]],
    ["signer-rsa", ["-t", "rsa", "-b", "3072"]],
  ])("verifies what ssh-keygen -Y sign makes, with an %s key", (name, type) => {
    const file = key(name, ...type);
    const message = path.join(dir, `${name}.txt`);
    fs.writeFileSync(message, "a nonce");
    keygen("-Y", "sign", "-f", file, "-n", "harpocrates-ssh-renew", message);
    const signature = fs.readFileSync(`${message}.sig`, "utf8");
    const signer = verifySshSignature(
      signature,
      Buffer.from("a nonce"),
      "harpocrates-ssh-renew",
    );
    expect(signer.fingerprint).toBe(
      parseSshPublicKey(fs.readFileSync(`${file}.pub`, "utf8")).fingerprint,
    );
    expect(() =>
      verifySshSignature(
        signature,
        Buffer.from("another"),
        "harpocrates-ssh-renew",
      ),
    ).toThrow(/does not verify/);
    expect(() =>
      verifySshSignature(signature, Buffer.from("a nonce"), "file"),
    ).toThrow(/signed for harpocrates-ssh-renew/);
  });
});
