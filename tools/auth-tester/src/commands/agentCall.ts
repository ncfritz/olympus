import { createOlympusClients } from "@ncfritz/olympus-client";
import { tlsAxiosOptions } from "@ncfritz/olympus-client/tls";
import { type Flags, optional, required } from "../args";
import { readServiceIdentity } from "../certificate";
import { TesterError } from "../errors";
import { method, request } from "../http";
import { printAnswer } from "../output";
import { missingPrefix } from "../paths";
import type { Settings } from "../settings";

/** Lower case letters, digits and dashes: what the metrics label allows. */
const CLIENT_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * A call on the mTLS listener with a service certificate: no token, no user,
 * and the identity in the handshake (ADR 0018).
 *
 * `X-Olympus-Client` defaults to the certificate's common name because the
 * API rejects a request where the two disagree -- a check worth exercising on
 * purpose with `--as`, and not worth failing by accident.
 */
export const agentCall = async (
  settings: Settings,
  flags: Flags,
  args: string[],
): Promise<number> => {
  const [asked, path] = args;
  if (asked === undefined || path === undefined) {
    throw new TesterError(
      "a method and a path are required: agent-call GET /olympus/ping",
    );
  }

  const certificate = required(
    flags,
    "cert",
    "the service certificate to present",
  );
  const key = required(flags, "key", "its private key");
  const identity = readServiceIdentity(certificate);
  const as = optional(flags, "as") ?? identity.commonName;
  if (!CLIENT_NAME.test(as)) {
    throw new TesterError(
      `${as} is not usable as a client name (lower case letters, digits and dashes); pass --as`,
    );
  }

  console.log(`Presenting ${identity.subject}`);
  console.log(`  issued by ${identity.issuer}, until ${identity.validTo}`);
  console.log(`  as ${as} on ${settings.servicesBaseUrl}`);

  // Without the CA that signed the API's own certificate, verification falls
  // back to the system trust store, which does not know a private CA -- so
  // --ca is all but required in dev.
  const ca = optional(flags, "ca");
  const clients = createOlympusClients({
    baseUrl: settings.servicesBaseUrl,
    clientName: as,
    axios: {
      ...tlsAxiosOptions({
        certificate,
        key,
        ...(ca === undefined ? {} : { ca }),
      }),
    },
  });

  const answer = await request(clients, { method: method(asked), path });
  printAnswer(answer);
  if (answer.status === 404) {
    const hint = missingPrefix(path);
    if (hint !== undefined) console.log(hint);
  }
  return answer.status >= 400 ? 1 : 0;
};
