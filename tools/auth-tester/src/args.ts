import { TesterError } from "./errors";

export type Flags = Record<string, string | true | undefined>;

export type Arguments = {
  /** What was passed, by flag name without the dashes. */
  flags: Flags;
  /** Everything that was not a flag, in order: the command and its arguments. */
  positional: string[];
};

export type FlagSpec = {
  /** Flags that stand alone: `--external`. */
  boolean?: readonly string[];
  /** Flags that take the next argument: `--api <url>`, or `--api=<url>`. */
  value?: readonly string[];
};

/**
 * The tester's own argument parsing, rather than a dependency.
 *
 * The flag set is a dozen names and none of them are clever -- no short
 * forms, no repetition, no negation -- so a parser is twenty lines, and a
 * tool whose job is to prove the API works is a poor place to be debugging
 * somebody else's argv handling.
 *
 * An unknown flag is an error rather than a positional argument: `--stale`
 * misspelt as `--state` would otherwise silently send an expired token,
 * which is the opposite of what was asked for.
 */
export const parseArguments = (argv: string[], spec: FlagSpec): Arguments => {
  const takesValue = new Set(spec.value ?? []);
  const standsAlone = new Set(spec.boolean ?? []);
  const flags: Flags = {};
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith("--") || argument === "--") {
      positional.push(argument);
      continue;
    }

    const equals = argument.indexOf("=");
    const name = (equals === -1 ? argument : argument.slice(0, equals)).slice(
      2,
    );
    const inlineValue = equals === -1 ? undefined : argument.slice(equals + 1);

    if (standsAlone.has(name)) {
      if (inlineValue !== undefined) {
        throw new TesterError(`--${name} takes no value`);
      }
      flags[name] = true;
      continue;
    }
    if (!takesValue.has(name)) {
      throw new TesterError(`unknown option --${name}`);
    }

    const value = inlineValue ?? argv[++index];
    if (value === undefined || value === "") {
      throw new TesterError(`--${name} needs a value`);
    }
    flags[name] = value;
  }

  return { flags, positional };
};

/** A flag's value, or a sentence naming what it is for. */
export const required = (flags: Flags, name: string, what: string): string => {
  const value = flags[name];
  if (typeof value !== "string") {
    throw new TesterError(`--${name} is required: ${what}`);
  }
  return value;
};

/** A flag's value, if it was passed at all. */
export const optional = (flags: Flags, name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};
