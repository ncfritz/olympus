import { SetMetadata } from "@nestjs/common";
import { PkiRole } from "./principal";

export const ROLES_KEY = "pkiRoles";
export const SIGNED_IN_KEY = "pkiSignedIn";
export const RECENT_SIGN_IN_KEY = "pkiRecentSignIn";

/**
 * The roles that may call a route; any one suffices. Every route behind
 * the access token names its roles: AuthGuard refuses one that does not.
 */
export const Roles = (...roles: PkiRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Anyone signed in, whatever their roles: what the console asks to learn
 * whether it is signed in and what it may offer (ADR 0032).
 */
export const SignedIn = () => SetMetadata(SIGNED_IN_KEY, true);

/** pki-admin only. */
export const AdminOnly = () => Roles(PkiRole.Admin);

/** Either role. */
export const AnyPkiRole = () => Roles(PkiRole.Admin, PkiRole.Operator);

/**
 * The access token's `auth_time` must be recent (AUTH_RECENT_SIGN_IN_SECONDS):
 * escrow export and ceremonies (ADR 0020, ADR 0018).
 */
export const RecentSignIn = () => SetMetadata(RECENT_SIGN_IN_KEY, true);
