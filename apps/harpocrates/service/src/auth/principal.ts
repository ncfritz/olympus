import type { Request } from "express";

/** The two roles Harpocrates knows (ADR 0020, Surfaces). */
export enum PkiRole {
  /** Everything, including CAs, ceremonies, the seal and escrow export. */
  Admin = "pki-admin",
  /** Issue, renew, revoke and read. */
  Operator = "pki-operator",
}

/**
 * Who did something: a user of the API's tokens, the break-glass CLI, or
 * Harpocrates itself (the scheduler).
 */
export type Principal = {
  /**
   * `user:<sub>`, `cli:<name>`, `certificate:<serial>`, `acme:<account>`
   * or `system`: what the audit log records.
   */
  id: string;
  roles: PkiRole[];
  /** When the session's sign-in completed, in seconds; 0 for the CLI. */
  authTime: number;
  /** Where it came from (ADR 0020, Audit). */
  surface: "api" | "cli" | "system" | "renewal" | "acme";
};

export type AuthenticatedRequest = Request & {
  principal?: Principal;
  /** The access token the principal came from, for asking the API about them. */
  accessToken?: string;
};

/** The principal for work Harpocrates does by itself. */
export const SYSTEM: Principal = {
  id: "system",
  roles: [PkiRole.Admin],
  authTime: 0,
  surface: "system",
};

/** An ACME account, acting through ACME (ADR 0020, ACME): no roles. */
export const acmePrincipal = (accountId: string): Principal => ({
  id: `acme:${accountId}`,
  roles: [],
  authTime: 0,
  surface: "acme",
});
