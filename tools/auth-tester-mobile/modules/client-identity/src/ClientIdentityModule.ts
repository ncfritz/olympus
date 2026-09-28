import { NativeModule, requireNativeModule } from "expo";
import type {
  ImportedIdentity,
  ServiceAnswer,
  ServiceRequest,
} from "./ClientIdentity.types";

/**
 * The identity lives in memory for the life of the process, not in the
 * Keychain: a tester that installed identities permanently would leave them
 * behind after a reinstall, and when to persist one is the real app's decision.
 */
declare class ClientIdentityModule extends NativeModule<Record<never, never>> {
  /** Keeps the identity a PKCS#12 holds, and says what it was. Rejects if the passphrase is wrong. */
  importIdentity(base64: string, password: string): Promise<ImportedIdentity>;
  /**
   * The authorities to validate the server against, as PEM, replacing whatever
   * was trusted before -- and *only* these, so a public certificate for the same
   * name does not pass as well. An empty string goes back to the system's.
   * Answers how many certificates it found.
   */
  trustAuthorities(pem: string): Promise<number>;
  /** Forgets the identity and the authorities: the end of a test. */
  forget(): void;
  hasIdentity(): boolean;
  /**
   * One request, presenting the identity if the server asks for one -- and
   * proceeding without it if none was imported, so that "the listener refuses a
   * caller with no certificate" is observable rather than hidden here.
   *
   * A refused handshake rejects with what the system said about it; there is no
   * status, because the listener never accepted the caller.
   */
  request(options: ServiceRequest): Promise<ServiceAnswer>;
}

export default requireNativeModule<ClientIdentityModule>("ClientIdentity");
