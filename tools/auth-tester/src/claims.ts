import { type DecodedToken } from "@ncfritz/olympus-auth-flow";

/**
 * Wide enough for the longest name printed here -- `client_id`, `auth_time` --
 * so the values line up in one column instead of the longer names shoving
 * theirs out of it.
 */
const NAME_WIDTH = 9;

const line = (name: string, value: string): string =>
  `  ${name.padEnd(NAME_WIDTH)} ${value}`;

/** The claims as lines, for printing: the ones that mean something first. */
export const describeToken = (token: DecodedToken): string[] => {
  const known = [
    "sub",
    "sid",
    "client_id",
    "roles",
    "aud",
    "iss",
    "iat",
    "auth_time",
    "exp",
  ];
  const lines = [
    line("alg", string_(token.header.alg)),
    line("kid", string_(token.header.kid)),
  ];
  for (const name of known) {
    if (name in token.claims) {
      lines.push(line(name, claim(name, token.claims[name])));
    }
  }
  for (const [name, value] of Object.entries(token.claims)) {
    if (!known.includes(name)) {
      lines.push(line(name, string_(value)));
    }
  }
  return lines;
};

/** Seconds since the epoch read as a time; anything else as it is. */
const claim = (name: string, value: unknown): string => {
  const times = ["iat", "exp", "auth_time"];
  if (times.includes(name) && typeof value === "number") {
    return `${value}  (${new Date(value * 1000).toISOString()})`;
  }
  return string_(value);
};

const string_ = (value: unknown): string =>
  Array.isArray(value) ? value.join(", ") : String(value);
