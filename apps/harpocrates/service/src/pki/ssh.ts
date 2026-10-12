/**
 * OpenSSH's own formats, as far as Harpocrates reads and writes them (ADR
 * 0035): a public key line, read to the SubjectPublicKeyInfo the key
 * model keys every key by; and a KRL (OpenSSH's PROTOCOL.krl), written by
 * serial for each SSH CA.
 */
import { createHash, createPublicKey } from "crypto";
import { keyAlgorithm } from "./x509";

/** An OpenSSH public key, read. */
export type SshPublicKey = {
  /** `ssh-ed25519`, `ecdsa-sha2-nistp256`, `ssh-rsa`, … */
  type: string;
  /** Its wire encoding: what a certificate and a KRL carry. */
  blob: Buffer;
  /** As X.509 holds it, for the key model. */
  spki: Buffer;
  /** As Harpocrates names key types: Ed25519, P-256, RSA-3072, … */
  algorithm: string;
  /** `SHA256:…`, as ssh-keygen -l prints it. */
  fingerprint: string;
};

/** An SSH wire buffer, read in order. */
class Reader {
  private offset = 0;
  constructor(private readonly data: Buffer) {}

  string(): Buffer {
    if (this.offset + 4 > this.data.length) throw new Error("truncated");
    const length = this.data.readUInt32BE(this.offset);
    const start = this.offset + 4;
    if (start + length > this.data.length) throw new Error("truncated");
    this.offset = start + length;
    return this.data.subarray(start, start + length);
  }

  get done(): boolean {
    return this.offset === this.data.length;
  }
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const CURVES: Record<string, string> = {
  nistp256: "P-256",
  nistp384: "P-384",
  nistp521: "P-521",
};

const base64url = (data: Buffer) => data.toString("base64url");

/** An mpint without the leading zero that keeps it positive. */
const unsigned = (mpint: Buffer) =>
  mpint.length > 1 && mpint[0] === 0 ? mpint.subarray(1) : mpint;

const spkiOf = (type: string, reader: Reader): Buffer => {
  if (type === "ssh-ed25519") {
    const key = reader.string();
    if (key.length !== 32) throw new Error("not an Ed25519 key");
    return Buffer.concat([ED25519_SPKI_PREFIX, key]);
  }
  if (type.startsWith("ecdsa-sha2-")) {
    const curve = reader.string().toString("ascii");
    const point = reader.string();
    const crv = CURVES[curve];
    if (!crv || type !== `ecdsa-sha2-${curve}` || point[0] !== 4) {
      throw new Error("not an ECDSA key OpenSSH takes");
    }
    const size = (point.length - 1) / 2;
    return createPublicKey({
      key: {
        kty: "EC",
        crv,
        x: base64url(point.subarray(1, 1 + size)),
        y: base64url(point.subarray(1 + size)),
      },
      format: "jwk",
    }).export({ type: "spki", format: "der" });
  }
  if (type === "ssh-rsa") {
    const e = unsigned(reader.string());
    const n = unsigned(reader.string());
    return createPublicKey({
      key: { kty: "RSA", n: base64url(n), e: base64url(e) },
      format: "jwk",
    }).export({ type: "spki", format: "der" });
  }
  throw new Error(`${type} keys are not taken`);
};

/**
 * An OpenSSH public key line (`ssh-ed25519 AAAA… comment`), read. Refuses
 * a certificate, a DSA or security-key type, or a malformed key.
 */
export const parseSshPublicKey = (line: string): SshPublicKey => {
  const [type, encoded] = line.trim().split(/\s+/);
  if (!type || !encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
    throw new Error("not an OpenSSH public key");
  }
  const blob = Buffer.from(encoded, "base64");
  const reader = new Reader(blob);
  if (reader.string().toString("ascii") !== type) {
    throw new Error("the key's type does not match its encoding");
  }
  const spki = spkiOf(type, reader);
  if (!reader.done) throw new Error("the key has bytes after its end");
  return {
    type,
    blob,
    spki,
    algorithm: keyAlgorithm(spki),
    fingerprint: `SHA256:${createHash("sha256").update(blob).digest("base64").replace(/=+$/, "")}`,
  };
};

// ---- KRL (OpenSSH PROTOCOL.krl)

const KRL_MAGIC = Buffer.from("SSHKRL\n\0", "binary");
const KRL_FORMAT_VERSION = 1;
const KRL_SECTION_CERTIFICATES = 1;
const KRL_SECTION_CERT_SERIAL_LIST = 0x20;

const uint32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
};

const uint64 = (value: bigint) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(value);
  return buffer;
};

const string = (data: Buffer | string) => {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return Buffer.concat([uint32(bytes.length), bytes]);
};

/**
 * A KRL revoking these serials of one CA's certificates. Unsigned:
 * sshd does not check a KRL's signature (ADR 0035), so it is served
 * over HTTPS instead.
 */
export const buildKrl = (krl: {
  /** The CA's public key, OpenSSH format. */
  caPublicKey: string;
  serials: bigint[];
  version: bigint;
  generatedAt: Date;
  comment: string;
}): Buffer => {
  const ca = parseSshPublicKey(krl.caPublicKey);
  const serials = [...new Set(krl.serials)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const sections: Buffer[] = [string(ca.blob), string("")];
  if (serials.length) {
    sections.push(
      Buffer.from([KRL_SECTION_CERT_SERIAL_LIST]),
      string(Buffer.concat(serials.map(uint64))),
    );
  }
  return Buffer.concat([
    KRL_MAGIC,
    uint32(KRL_FORMAT_VERSION),
    uint64(krl.version),
    uint64(BigInt(Math.floor(krl.generatedAt.getTime() / 1000))),
    uint64(0n),
    string(""),
    string(krl.comment),
    Buffer.from([KRL_SECTION_CERTIFICATES]),
    string(Buffer.concat(sections)),
  ]);
};
