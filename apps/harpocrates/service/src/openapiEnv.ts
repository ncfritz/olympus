/**
 * Placeholder values for configuration the OpenAPI document doesn't depend
 * on but AppModule requires. Imported by openapi.ts before AppModule; the
 * files they name are never read: nothing connects.
 */
process.env.SIGNER_SOCKET_PATH ||= "/nonexistent/signer.sock";
process.env.SIGNER_TOKEN_FILE ||= "/nonexistent/token";
if (!process.env.AUTH_JWKS_URL) {
  process.env.AUTH_JWKS_FILE ||= "/nonexistent/jwks.json";
}

export {};
