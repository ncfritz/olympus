/**
 * Presenting a client certificate from the app's own requests (ADR 0018).
 *
 * React Native's networking cannot do it: the identity has to reach a
 * `URLSession` delegate, and only native code holds one. Everything here is
 * the shape of that native surface; `ios/ClientIdentityModule.swift` is the
 * implementation, and there is no other.
 */

/** What a PKCS#12 turned out to hold. */
export type ImportedIdentity = {
  /**
   * The certificate's subject summary, which for the certificates this deployment
   * issues is the common name -- so it is also what `X-Olympus-Client` has to
   * say for the API to accept the call.
   */
  subject: string;
  /** How many certificates came with the key, the leaf included. */
  chainLength: number;
};

/** One request, made by the native side rather than by React Native. */
export type ServiceRequest = {
  /** Absolute: there is no base URL on this side. */
  url: string;
  /** Default GET. */
  method?: string;
  headers?: Record<string, string>;
  /** Text only. Nothing here serializes a form or a stream. */
  body?: string;
  /** Seconds, default 30. A handshake that will fail should fail promptly. */
  timeout?: number;
};

export type ServiceAnswer = {
  status: number;
  /** Lower-cased names, as `URLSession` reported them. */
  headers: Record<string, string>;
  /** Decoded as UTF-8, or empty. Nothing here reads a binary answer. */
  body: string;
};
