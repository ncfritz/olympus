/**
 * Placeholder values for configuration the OpenAPI documents don't depend
 * on but AppModule requires. Imported by openapi.ts before AppModule.
 */
process.env.DIONYSUS_UPLOAD_PATH ||= "/tmp/olympus-openapi";
process.env.DIONYSUS_PUBLISH_PATH ||= "/tmp/olympus-openapi";

export {};
