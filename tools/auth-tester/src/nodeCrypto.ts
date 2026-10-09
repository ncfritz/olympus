import { createHash, randomBytes } from "crypto";
import type { FlowCrypto } from "@ncfritz/olympus-auth-flow";

/**
 * Node's half of what the flow needs. The mobile tester's is `expo-crypto`;
 * the flow itself knows about neither.
 */
export const nodeCrypto: FlowCrypto = {
  randomBase64Url: (bytes) => randomBytes(bytes).toString("base64url"),
  sha256Base64Url: (text) =>
    createHash("sha256").update(text).digest("base64url"),
};
