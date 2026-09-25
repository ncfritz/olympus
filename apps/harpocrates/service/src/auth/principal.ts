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
  /** `user:<sub>`, `cli:<name>` or `system`: what the audit log records. */
  id: string;
  roles: PkiRole[];
  /** When the session's sign-in completed, in seconds; 0 for the CLI. */
  authTime: number;
  /** Where it came from (ADR 0020, Audit). */
  surface: "api" | "cli" | "system";
};

export type AuthenticatedRequest = Request & { principal?: Principal };

/** The principal for work Harpocrates does by itself. */
export const SYSTEM: Principal = {
  id: "system",
  roles: [PkiRole.Admin],
  authTime: 0,
  surface: "system",
};
