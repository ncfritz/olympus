import type { Principal } from "../auth/principal";
import type { ConsoleAuthService } from "../auth/services/ConsoleAuthService";

/** The signed-in identity's email, from the Olympus API; none for the CLI. */
export const signedInEmail = async (
  consoleAuth: ConsoleAuthService,
  principal: Principal,
  accessToken: string | undefined,
): Promise<string | undefined> =>
  principal.surface === "api" && accessToken
    ? (await consoleAuth.currentUser(principal, accessToken)).email
    : undefined;
