import type { Request } from "express";

/** The two roles Harpocrates knows (ADR 0020, Surfaces). */
export enum PkiRole {
  /** Everything, including CAs, ceremonies, the seal and escrow export. */
  Admin = "pki-admin",
  /** Issue, renew, revoke and read. */
  Operator = "pki-operator",
}

/** Who made a request: a user of the API's tokens, or the break-glass CLI. */
export type Principal = {
  /** `user:<sub>` or `cli:<name>`: what the audit log records. */
  id: string;
  roles: PkiRole[];
  /** When the session's sign-in completed, in seconds; 0 for the CLI. */
  authTime: number;
  /** api or cli. */
  surface: "api" | "cli";
};

export type AuthenticatedRequest = Request & { principal?: Principal };

/** The principal for work Harpocrates does by itself. */
export const SYSTEM: Principal = {
  id: "system",
  roles: [PkiRole.Admin],
  authTime: 0,
  surface: "cli",
};
