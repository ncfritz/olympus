/**
 * A principal as the console names it. Harpocrates records who did
 * something as `user:<id>` (the Olympus user's ID, all an access token
 * carries), `cli:<name>`, `acme:<account>`, `certificate:<serial>` (a
 * holder renewing over mTLS) or `system`; people are named by the email
 * the Olympus API gave when they last signed in to the console.
 */
export const principalName = (
  principal: string,
  emails: Map<string, string> | undefined,
): string => {
  if (principal === "system") return "Harpocrates";
  const [type, ...rest] = principal.split(":");
  const id = rest.join(":");
  switch (type) {
    case "user":
      return emails?.get(principal) ?? `Olympus user ${id.slice(0, 8)}`;
    case "cli":
      return `${id} (CLI)`;
    case "acme":
      return `ACME account ${id.slice(0, 8)}`;
    case "certificate":
      return "Its holder, over mTLS";
    default:
      return principal;
  }
};

/** Whether a principal is a person, rather than Harpocrates or a client. */
export const isPerson = (principal: string): boolean =>
  principal.startsWith("user:") || principal.startsWith("cli:");
