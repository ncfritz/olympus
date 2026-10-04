import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "../../auth/authUser";
import {
  type OlympusAnswer,
  OlympusApiService,
} from "../../auth/services/OlympusApiService";

/** Where the console asks for the API's operations, under this agent. */
export const FORWARD_PREFIX = "/olympus";

/**
 * The API's operations the console may call through the agent: the
 * signed-in user's availability (ADR 0029), and the calendar events that
 * could not be written to Minerva, which the Publish page shows and
 * redrives (ADR 0028, amended); nothing else. A method and a path under
 * /v1, its query string aside. The API decides who may: the dead letters
 * are for admins.
 */
const FORWARDED: { methods: string[]; path: RegExp }[] = [
  { methods: ["GET"], path: /^\/v1\/minerva\/availability$/ },
  { methods: ["GET", "POST"], path: /^\/v1\/minerva\/availability-blocks$/ },
  {
    methods: ["GET", "PUT", "DELETE"],
    path: /^\/v1\/minerva\/availability-block\/[^/]+$/,
  },
  { methods: ["GET"], path: /^\/v1\/minerva\/meeting-availabilities$/ },
  {
    methods: ["PUT", "DELETE"],
    path: /^\/v1\/minerva\/meeting\/[^/]+\/availability$/,
  },
  { methods: ["GET"], path: /^\/v1\/minerva\/calendar-events\/dead-letters$/ },
  {
    methods: ["POST"],
    path: /^\/v1\/minerva\/calendar-events\/dead-letters\/redrive$/,
  },
];

/**
 * The console's calls on the Olympus API (ADR 0029). The console's access
 * token is an httpOnly cookie on the console's own origin, so the console
 * cannot present it to the API itself; the agent does, as the signed-in
 * user, for the operations above. What the API answers is answered as it
 * is.
 */
@Injectable()
export class OlympusForwardingService {
  constructor(private readonly api: OlympusApiService) {}

  /**
   * @param url the request's URL as the agent received it:
   *   `/olympus/v1/...?...`
   * @throws NotFoundException for anything not forwarded,
   *   BadGatewayException when the API cannot be reached
   */
  async forward(
    user: AuthUser,
    method: string,
    url: string,
    timeZone: string | undefined,
    body: unknown,
  ): Promise<OlympusAnswer> {
    const target = forwardedPath(method, url);
    if (target === undefined) {
      throw new NotFoundException(
        `${method} ${url} is not forwarded to Olympus`,
      );
    }
    try {
      return await this.api.forward({
        method,
        path: target,
        accessToken: user.accessToken,
        timeZone,
        body,
      });
    } catch (error) {
      throw new BadGatewayException("The Olympus API cannot be reached", {
        cause: error,
      });
    }
  }
}

/** The API's path and query for a request the agent forwards; undefined for any other. */
export const forwardedPath = (
  method: string,
  url: string,
): string | undefined => {
  if (!url.startsWith(`${FORWARD_PREFIX}/`)) return undefined;
  const target = url.slice(FORWARD_PREFIX.length);
  const queryAt = target.indexOf("?");
  const path = queryAt === -1 ? target : target.slice(0, queryAt);
  // The path the API will be sent is the one the URL parser makes of it:
  // it resolves dot segments, plain or encoded, reads a backslash as a
  // slash and stops at a fragment. Anything it would change is refused, so
  // the pattern below checks what is actually sent; it drops or encodes a
  // control character too. An encoded slash stays encoded, inside its
  // segment: a meeting's ID may have one.
  let parsed: URL;
  try {
    parsed = new URL(target, "http://olympus.invalid");
  } catch {
    return undefined;
  }
  if (
    parsed.origin !== "http://olympus.invalid" ||
    parsed.pathname !== path ||
    parsed.hash !== "" ||
    /[\\#]/.test(target)
  ) {
    return undefined;
  }
  const allowed = FORWARDED.some(
    (entry) => entry.path.test(path) && entry.methods.includes(method),
  );
  return allowed ? target : undefined;
};
