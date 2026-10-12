/**
 * OpenSSH's own formats, as far as Harpocrates reads and writes them (ADR
 * 0035): a public key line, read to the SubjectPublicKeyInfo the key
 * model keys every key by; and a KRL (OpenSSH's PROTOCOL.krl), written by
 * serial for each SSH CA.
 */
import { createHash, createPublicKey, verify } from "crypto";
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

  bytes(count: number): Buffer {
    if (this.offset + count > this.data.length) throw new Error("truncated");
    const start = this.offset;
    this.offset += count;
    return this.data.subarray(start, this.offset);
  }

  uint32(): number {
    return this.bytes(4).readUInt32BE(0);
  }

  uint64(): bigint {
    return this.bytes(8).readBigUInt64BE(0);
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

/** A key from its wire encoding: what a certificate or signature carries. */
export const sshPublicKeyFromBlob = (blob: Buffer): SshPublicKey => {
  const reader = new Reader(blob);
  const type = reader.string().toString("ascii");
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

/**
 * An OpenSSH public key line (`ssh-ed25519 AAAA… comment`), read. Refuses
 * a certificate, a DSA or security-key type, or a malformed key.
 */
export const parseSshPublicKey = (line: string): SshPublicKey => {
  const [type, encoded] = line.trim().split(/\s+/);
  if (!type || !encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
    throw new Error("not an OpenSSH public key");
  }
  const key = sshPublicKeyFromBlob(Buffer.from(encoded, "base64"));
  if (key.type !== type) {
    throw new Error("the key's type does not match its encoding");
  }
  return key;
};

// ---- certificates (OpenSSH PROTOCOL.certkeys)

const CERTIFICATE_SUFFIX = "-cert-v01@openssh.com";

/** What an OpenSSH certificate says, read back. */
export type SshCertificateContents = {
  type: "user" | "host";
  /** The certified key's type: `ssh-ed25519`, … */
  keyType: string;
  serial: bigint;
  keyId: string;
  principals: string[];
  validAfter: Date;
  validBefore: Date;
  /** By name, with their values; `force-command`, `source-address`. */
  criticalOptions: { name: string; value: string }[];
  extensions: string[];
  /** The signing CA's key, `SHA256:…`. */
  caFingerprint: string;
};

/** A certificate's packed name/data pairs: critical options or extensions. */
const options = (packed: Buffer): { name: string; value: string }[] => {
  const reader = new Reader(packed);
  const read: { name: string; value: string }[] = [];
  while (!reader.done) {
    const name = reader.string().toString("utf8");
    const data = reader.string();
    read.push({
      name,
      value: data.length ? new Reader(data).string().toString("utf8") : "",
    });
  }
  return read;
};

/** A time as a certificate holds it; the largest is "forever". */
const certificateTime = (seconds: bigint) =>
  new Date(
    seconds > 8_640_000_000_000n
      ? 8_640_000_000_000_000
      : Number(seconds) * 1000,
  );

/**
 * An OpenSSH certificate line (`ssh-ed25519-cert-v01@openssh.com AAAA…`),
 * read: what it certifies and says. Its signature is not checked.
 */
export const parseSshCertificate = (line: string): SshCertificateContents => {
  const [, encoded] = line.trim().split(/\s+/);
  if (!encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) {
    throw new Error("not an OpenSSH certificate");
  }
  const reader = new Reader(Buffer.from(encoded, "base64"));
  const certificateType = reader.string().toString("ascii");
  if (!certificateType.endsWith(CERTIFICATE_SUFFIX)) {
    throw new Error("not an OpenSSH certificate");
  }
  const keyType = certificateType.slice(0, -CERTIFICATE_SUFFIX.length);
  reader.string(); // nonce
  spkiOf(keyType, reader);
  const serial = reader.uint64();
  const kind = reader.uint32();
  if (kind !== 1 && kind !== 2) throw new Error("neither user nor host");
  const keyId = reader.string().toString("utf8");
  const principals: string[] = [];
  const packed = new Reader(reader.string());
  while (!packed.done) principals.push(packed.string().toString("utf8"));
  const validAfter = certificateTime(reader.uint64());
  const validBefore = certificateTime(reader.uint64());
  const criticalOptions = options(reader.string());
  const extensions = options(reader.string()).map((e) => e.name);
  reader.string(); // reserved
  const ca = sshPublicKeyFromBlob(reader.string());
  reader.string(); // signature
  if (!reader.done) throw new Error("the certificate has bytes after its end");
  return {
    type: kind === 1 ? "user" : "host",
    keyType,
    serial,
    keyId,
    principals,
    validAfter,
    validBefore,
    criticalOptions,
    extensions,
    caFingerprint: ca.fingerprint,
  };
};

// ---- signatures (OpenSSH PROTOCOL.sshsig): what `ssh-keygen -Y sign` makes

const SSHSIG_MAGIC = Buffer.from("SSHSIG", "ascii");

const MESSAGE_HASHES = new Set(["sha256", "sha512"]);

/** ECDSA's hash and its numbers' size, by curve. */
const ECDSA: Record<string, { hash: string; size: number }> = {
  "ecdsa-sha2-nistp256": { hash: "sha256", size: 32 },
  "ecdsa-sha2-nistp384": { hash: "sha384", size: 48 },
  "ecdsa-sha2-nistp521": { hash: "sha512", size: 66 },
};

const RSA_SIGNATURES: Record<string, string> = {
  "rsa-sha2-256": "sha256",
  "rsa-sha2-512": "sha512",
};

/** A number, as wide as its curve wants it. */
const fixed = (mpint: Buffer, size: number) => {
  const value = unsigned(mpint);
  if (value.length > size) throw new Error("an ECDSA number is too long");
  return Buffer.concat([Buffer.alloc(size - value.length), value]);
};

/**
 * Who signed `message` in `namespace`: the key of an armored SSH
 * signature, once it verifies over the message. Throws when it is
 * malformed, for another namespace, or does not verify.
 */
export const verifySshSignature = (
  armored: string,
  message: Buffer,
  namespace: string,
): SshPublicKey => {
  const body = armored
    .replace(/-----(BEGIN|END) SSH SIGNATURE-----/g, "")
    .replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+=*$/.test(body)) {
    throw new Error("not an SSH signature");
  }
  const reader = new Reader(Buffer.from(body, "base64"));
  if (!reader.bytes(6).equals(SSHSIG_MAGIC) || reader.uint32() !== 1) {
    throw new Error("not an SSH signature");
  }
  const key = sshPublicKeyFromBlob(reader.string());
  const signedNamespace = reader.string().toString("utf8");
  const reserved = reader.string();
  const hash = reader.string().toString("ascii");
  const signature = new Reader(reader.string());
  if (!reader.done) throw new Error("the signature has bytes after its end");
  if (signedNamespace !== namespace) {
    throw new Error(`signed for ${signedNamespace}, not ${namespace}`);
  }
  if (!MESSAGE_HASHES.has(hash)) throw new Error(`${hash} is not taken`);
  const signed = Buffer.concat([
    SSHSIG_MAGIC,
    string(namespace),
    string(reserved),
    string(hash),
    string(createHash(hash).update(message).digest()),
  ]);
  const type = signature.string().toString("ascii");
  const bytes = signature.string();
  const publicKey = createPublicKey({
    key: key.spki,
    format: "der",
    type: "spki",
  });
  let verified: boolean;
  if (key.type === "ssh-ed25519" && type === "ssh-ed25519") {
    verified = verify(null, signed, publicKey, bytes);
  } else if (ECDSA[key.type] && type === key.type) {
    const { hash: digest, size } = ECDSA[key.type];
    const numbers = new Reader(bytes);
    const r = fixed(numbers.string(), size);
    const s = fixed(numbers.string(), size);
    verified = verify(
      digest,
      signed,
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.concat([r, s]),
    );
  } else if (key.type === "ssh-rsa" && RSA_SIGNATURES[type]) {
    verified = verify(RSA_SIGNATURES[type], signed, publicKey, bytes);
  } else {
    throw new Error(`a ${type} signature by a ${key.type} key is not taken`);
  }
  if (!verified) throw new Error("the signature does not verify");
  return key;
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
