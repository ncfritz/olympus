/**
 * Placeholder values for configuration the OpenAPI document doesn't depend
 * on but AppModule requires. Imported by openapi.ts before AppModule; never
 * used to log in or sign anything.
 */
process.env.AUTH_JWT_SECRET ||= "openapi-generation-placeholder";
process.env.AUTH_OIDC_PROVIDERS ||= "[]";

export {};
