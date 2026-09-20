import { readConfig, type AgentConfig } from "../../src/config/configuration";

/** The agent's configuration from `env` plus the one required variable. */
export const testConfig = (
  env: Record<string, string | undefined> = {},
): AgentConfig => readConfig({ AUTH_JWT_SECRET: "test-secret", ...env });
