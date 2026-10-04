import { olympus } from "./olympus-fake";

export { E2E_USER_ID } from "./olympus-fake";

/**
 * An Olympus access token with the admin role, signed with the keys the
 * fake API publishes (see env-setup.ts): what the console's sign-in leaves
 * in its cookie, with no identity provider involved.
 */
export function issueE2eAccessToken(
  claims: { sub?: string; roles?: string[]; exp?: number } = {},
): string {
  return olympus.token(claims);
}
