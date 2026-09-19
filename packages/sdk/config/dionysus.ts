import { defineConfig } from "@hey-api/openapi-ts";
import { buildConfigForNamedApi } from "./config";

export default defineConfig(buildConfigForNamedApi("dionysus"));
