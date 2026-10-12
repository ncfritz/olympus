/**
 * OCSP's wire, as far as the responder reads and writes it (RFC 6960,
 * ADR 0036): a request read to the one CertID it asks about, a CA's
 * CertID hashes, and the unsigned responses that carry only a status.
 */
import { createHash } from "crypto";
import * as x509 from "@peculiar/x509";

/** One DER element: its tag, and where its contents are. */
type Element = { tag: number; start: number; end: number };

/** A DER buffer, read element by element. */
class Der {
  constructor(
    private readonly data: Buffer,
    private offset = 0,
    private readonly limit = data.length,
  ) {}

  get done(): boolean {
    return this.offset >= this.limit;
  }

  peekTag(): number | undefined {
    return this.done ? undefined : this.data[this.offset];
  }

  next(expected?: number): Element {
    if (this.offset + 2 > this.limit) throw new Error("truncated");
    const tag = this.data[this.offset];
    if ((tag & 0x1f) === 0x1f) throw new Error("a high tag number");
    if (expected !== undefined && tag !== expected) {
      throw new Error(`expected tag ${expected}, found ${tag}`);
    }
    let length = this.data[this.offset + 1];
    let start = this.offset + 2;
    if (length & 0x80) {
      const count = length & 0x7f;
      if (count === 0 || count > 4) throw new Error("a length DER forbids");
      if (start + count > this.limit) throw new Error("truncated");
      length = 0;
      for (let i = 0; i < count; i++)
        length = length * 256 + this.data[start + i];
      start += count;
    }
    const end = start + length;
    if (end > this.limit) throw new Error("truncated");
    this.offset = end;
    return { tag, start, end };
  }

  /** The element's contents, to read within. */
  inside(element: Element): Der {
    return new Der(this.data, element.start, element.end);
  }

  bytes(element: Element): Buffer {
    return this.data.subarray(element.start, element.end);
  }
}

const SEQUENCE = 0x30;
const OCTET_STRING = 0x04;
const INTEGER = 0x02;
const OID = 0x06;
const BIT_STRING = 0x03;

/** A DER OID's dotted form. */
const dotted = (bytes: Buffer): string => {
  const parts: number[] = [];
  let value = 0;
  for (const byte of bytes) {
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  const first = parts.shift() ?? 0;
  const head =
    first < 80 ? [Math.floor(first / 40), first % 40] : [2, first - 80];
  return [...head, ...parts].join(".");
};

const HASHES: Record<string, CertIdHash> = {
  "1.3.14.3.2.26": "sha1",
  "2.16.840.1.101.3.4.2.1": "sha256",
};

export type CertIdHash = "sha1" | "sha256";

/** What a request asks about: one certificate, by its CertID. */
export type OcspQuestion = {
  /** The CertID's hash, or its OID when it is neither SHA-1 nor SHA-256. */
  hash: CertIdHash | string;
  issuerNameHash: Buffer;
  issuerKeyHash: Buffer;
  /** Hex, lower case, no leading zeros: as Harpocrates keeps serials. */
  serial: string;
};

/**
 * An OCSPRequest (RFC 6960, 4.1.1) read to its one CertID. A request for
 * several certificates is refused, as the RFC 5019 profile has clients
 * send one; extensions (a nonce) and a signature are passed over.
 */
export const parseOcspRequest = (der: Buffer): OcspQuestion => {
  const top = new Der(der);
  const request = top.next(SEQUENCE);
  if (!top.done) throw new Error("bytes after the request");
  const ocspRequest = top.inside(request);
  const tbs = ocspRequest.inside(ocspRequest.next(SEQUENCE));
  // version [0] and requestorName [1], when present.
  while (tbs.peekTag() === 0xa0 || tbs.peekTag() === 0xa1) tbs.next();
  const list = tbs.inside(tbs.next(SEQUENCE));
  const one = list.inside(list.next(SEQUENCE));
  if (!list.done) throw new Error("more than one certificate asked about");
  const certId = one.inside(one.next(SEQUENCE));
  const algorithm = certId.inside(certId.next(SEQUENCE));
  const oid = dotted(algorithm.bytes(algorithm.next(OID)));
  const issuerNameHash = certId.bytes(certId.next(OCTET_STRING));
  const issuerKeyHash = certId.bytes(certId.next(OCTET_STRING));
  const serialBytes = certId.bytes(certId.next(INTEGER));
  if (serialBytes.length === 0 || serialBytes[0] & 0x80) {
    throw new Error("a serial that is not positive");
  }
  return {
    hash: HASHES[oid] ?? oid,
    issuerNameHash: Buffer.from(issuerNameHash),
    issuerKeyHash: Buffer.from(issuerKeyHash),
    serial: serialBytes.toString("hex").replace(/^0+(?=.)/, ""),
  };
};

/**
 * A CA's CertID hashes: over its subject's DER, and over its public key's
 * bits (the BIT STRING's value, not the whole SubjectPublicKeyInfo).
 */
export const certIdHashes = (
  certificateDer: Uint8Array,
  hash: CertIdHash,
): { issuerNameHash: Buffer; issuerKeyHash: Buffer } => {
  const certificate = new x509.X509Certificate(new Uint8Array(certificateDer));
  const spki = new Der(Buffer.from(certificate.publicKey.rawData));
  const info = spki.inside(spki.next(SEQUENCE));
  info.next(SEQUENCE);
  const bits = info.bytes(info.next(BIT_STRING)).subarray(1);
  const digest = (data: Uint8Array) => createHash(hash).update(data).digest();
  return {
    issuerNameHash: digest(
      Buffer.from(certificate.subjectName.toArrayBuffer()),
    ),
    issuerKeyHash: digest(bits),
  };
};

/** An OCSPResponse's status (RFC 6960, 4.2.1). */
export const OcspResponseStatus = {
  malformedRequest: 1,
  internalError: 2,
  tryLater: 3,
  unauthorized: 6,
} as const;

/** A response that is a status alone: no body, unsigned. */
export const unsignedOcspResponse = (
  status: (typeof OcspResponseStatus)[keyof typeof OcspResponseStatus],
): Buffer => Buffer.from([0x30, 0x03, 0x0a, 0x01, status]);
