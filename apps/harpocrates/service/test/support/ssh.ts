import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject,
} from "crypto";

/** An SSH wire string. */
const field = (data: Buffer | string) => {
  const bytes = typeof data === "string" ? Buffer.from(data) : data;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
};

const wrap = (base64: string, width: number) =>
  base64.match(new RegExp(`.{1,${width}}`, "g"))!.join("\n");

/** An Ed25519 key as OpenSSH holds it: a host key, for the tests. */
export type SshTestKey = {
  privateKey: KeyObject;
  /** Its wire encoding. */
  blob: Buffer;
  /** `ssh-ed25519 AAAA… comment`. */
  publicKey: string;
  /** OpenSSH's private key file, unencrypted, as ssh-keygen reads it. */
  privateKeyFile: string;
};

export const sshTestKey = (comment = "test"): SshTestKey => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const seed = privateKey
    .export({ type: "pkcs8", format: "der" })
    .subarray(-32);
  const blob = Buffer.concat([field("ssh-ed25519"), field(pub)]);
  // PROTOCOL.key: no cipher, one key, padded to the cipher's block of 8.
  const check = randomBytes(4);
  let secret = Buffer.concat([
    check,
    check,
    field("ssh-ed25519"),
    field(pub),
    field(Buffer.concat([seed, pub])),
    field(comment),
  ]);
  const padding = Buffer.from(
    Array.from({ length: (8 - (secret.length % 8)) % 8 }, (_, i) => i + 1),
  );
  secret = Buffer.concat([secret, padding]);
  const file = Buffer.concat([
    Buffer.from("openssh-key-v1\0", "binary"),
    field("none"),
    field("none"),
    field(""),
    Buffer.from([0, 0, 0, 1]),
    field(blob),
    field(secret),
  ]);
  return {
    privateKey,
    blob,
    publicKey: `ssh-ed25519 ${blob.toString("base64")} ${comment}`,
    privateKeyFile: `-----BEGIN OPENSSH PRIVATE KEY-----\n${wrap(file.toString("base64"), 70)}\n-----END OPENSSH PRIVATE KEY-----\n`,
  };
};

/** What `ssh-keygen -Y sign -n <namespace>` makes of `message` (PROTOCOL.sshsig). */
export const sshSign = (
  key: SshTestKey,
  message: Buffer | string,
  namespace: string,
): string => {
  const magic = Buffer.from("SSHSIG");
  const hash = createHash("sha512").update(message).digest();
  const signed = Buffer.concat([
    magic,
    field(namespace),
    field(""),
    field("sha512"),
    field(hash),
  ]);
  const signature = sign(null, signed, key.privateKey);
  const version = Buffer.from([0, 0, 0, 1]);
  const blob = Buffer.concat([
    magic,
    version,
    field(key.blob),
    field(namespace),
    field(""),
    field("sha512"),
    field(Buffer.concat([field("ssh-ed25519"), field(signature)])),
  ]);
  return `-----BEGIN SSH SIGNATURE-----\n${wrap(blob.toString("base64"), 76)}\n-----END SSH SIGNATURE-----\n`;
};
