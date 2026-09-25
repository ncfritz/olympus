/**
 * `pnpm auth:user` — the user directory's administration CLI.
 *
 * Signing in does not create anyone: a provider identity links to a user
 * that already exists, and a person the directory does not know is refused
 * (ADR 0018). So this is how the first user comes to exist, and nothing
 * about authentication works until it has been run once.
 *
 *   pnpm --filter @ncfritz/olympus-api build
 *   pnpm --filter @ncfritz/olympus-api auth:user list          # dev.env
 *   pnpm --filter @ncfritz/olympus-api auth:user:prod list     # production.env
 *
 * It talks to Hasura with the admin secret from the same environment file
 * the API itself reads, and it is the only thing besides the API that does
 * — which is the reason it lives in this package rather than in tools/.
 */
import "source-map-support/register";

import { GraphQLClient } from "graphql-request";
import { readConfig } from "./config/configuration";
import {
  type AdminUser,
  UserAdministration,
  UserAdministrationError,
} from "./auth/users/UserAdministration";

const USAGE = `Usage: auth:user <command>

  list                              every user, with roles and linked identities
  show    <email|id>                one user
  add     <email> <name> [role...]  creates a user
  roles   <email|id> <role...>      replaces their roles with exactly these
  roles   <email|id> --clear        removes all of their roles
  disable <email|id>                refuse them at the next sign-in or refresh
  enable  <email|id>                undo that
  unlink  <email|id> <provider>     forget a provider identity, so it links again

A name with spaces needs quoting. Roles are lower case and compared
exactly, so "admin" and "Admin" would be two different roles.`;

const describe = (user: AdminUser): string => {
  const lines = [
    `${user.email}${user.disabled ? "  [disabled]" : ""}`,
    `  ${user.displayName}`,
    `  id      ${user.id}`,
    `  roles   ${user.roles.length > 0 ? user.roles.join(", ") : "(none)"}`,
  ];
  if (user.identities.length === 0) {
    lines.push("  signed in with nothing yet");
  }
  for (const identity of user.identities) {
    lines.push(
      `  ${identity.provider}  ${identity.subject} (${identity.email})`,
    );
  }
  return lines.join("\n");
};

/** One argument, or a usage error naming what was expected. */
const arg = (args: string[], index: number, what: string): string => {
  const value = args[index];
  if (value === undefined || value === "") {
    throw new UserAdministrationError(`${what} is required\n\n${USAGE}`);
  }
  return value;
};

async function run(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  // Fails fast on a bad environment file, listing every invalid variable,
  // and with the same message the API would give.
  const config = readConfig(process.env);
  if (config.hasura.adminSecret === "") {
    // Hasura's own answer to this is about a missing header, which sends
    // people looking in the wrong place.
    throw new UserAdministrationError(
      "HASURA_PASSWORD (or HASURA_PASSWORD_FILE) is not set, so every query would be refused",
    );
  }
  const users = new UserAdministration(
    new GraphQLClient(config.hasura.endpoint, {
      headers: {
        "content-type": "application/json",
        "x-hasura-admin-secret": config.hasura.adminSecret,
      },
    }),
  );

  switch (command) {
    case "list": {
      const all = await users.list();
      if (all.length === 0) {
        // The state the system ships in, and the reason this command exists.
        console.log("No users. Nobody can sign in until there is one.");
        return;
      }
      console.log(all.map(describe).join("\n\n"));
      return;
    }

    case "show": {
      console.log(
        describe(await users.require(arg(args, 0, "an email or id"))),
      );
      return;
    }

    case "add": {
      const created = await users.add({
        email: arg(args, 0, "an email"),
        displayName: arg(args, 1, "a display name"),
        roles: args.slice(2),
      });
      console.log(`Created:\n${describe(created)}`);
      return;
    }

    case "roles": {
      const who = await users.require(arg(args, 0, "an email or id"));
      const asked = args.slice(1);
      // --clear rather than "no arguments", so that a forgotten role list
      // does not silently take every role away.
      const clearing = asked.length === 1 && asked[0] === "--clear";
      if (asked.length === 0) {
        throw new UserAdministrationError(
          `a role is required, or --clear to remove them all\n\n${USAGE}`,
        );
      }
      const roles = await users.setRoles(who.id, clearing ? [] : asked);
      console.log(
        `${who.email}: ${roles.length > 0 ? roles.join(", ") : "no roles"}`,
      );
      return;
    }

    case "disable":
    case "enable": {
      const who = await users.require(arg(args, 0, "an email or id"));
      const disabled = command === "disable";
      await users.setDisabled(who.id, disabled);
      console.log(
        disabled
          ? `${who.email} is disabled; their sessions stop working at the next refresh.`
          : `${who.email} may sign in again.`,
      );
      return;
    }

    case "unlink": {
      const who = await users.require(arg(args, 0, "an email or id"));
      const provider = arg(args, 1, "a provider");
      const removed = await users.unlink(who.id, provider);
      console.log(
        removed === 0
          ? `${who.email} had no ${provider} identity.`
          : `Forgot ${who.email}'s ${provider} identity; the next sign-in will link again by verified email.`,
      );
      return;
    }

    default:
      throw new UserAdministrationError(
        `unknown command ${command}\n\n${USAGE}`,
      );
  }
}

run(process.argv.slice(2))
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    // Anything the operator can fix prints as a sentence. Everything else —
    // a Hasura error, a bad admin secret — prints in full, because the
    // detail is the only clue.
    if (error instanceof UserAdministrationError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
