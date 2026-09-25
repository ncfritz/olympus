import { SetMetadata } from "@nestjs/common";
import { PkiRole } from "./principal";

export const ROLES_KEY = "pkiRoles";
export const RECENT_SIGN_IN_KEY = "pkiRecentSignIn";

/**
 * The roles that may call a route; any one suffices. Every route behind
 * the access token names its roles: AuthGuard refuses one that does not.
 */
export const Roles = (...roles: PkiRole[]) => SetMetadata(ROLES_KEY, roles);

/** pki-admin only. */
export const AdminOnly = () => Roles(PkiRole.Admin);

/** Either role. */
export const AnyPkiRole = () => Roles(PkiRole.Admin, PkiRole.Operator);

/**
 * The access token's `auth_time` must be recent (AUTH_RECENT_SIGN_IN_SECONDS):
 * escrow export and ceremonies (ADR 0020, ADR 0018).
 */
export const RecentSignIn = () => SetMetadata(RECENT_SIGN_IN_KEY, true);
