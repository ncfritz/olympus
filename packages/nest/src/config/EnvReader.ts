import { readFileSync } from "fs";

/**
 * Reads typed values from environment variables, collecting every problem
 * so a misconfigured deployment is reported in one go at boot.
 *
 * Any variable can instead be given as a file: `NAME_FILE` is the path
 * of a file holding the value, which is how Compose secrets arrive
 * (`/run/secrets/<name>`, ADR 0019). Setting both is a problem.
 */
export class EnvReader {
  readonly problems: string[] = [];

  constructor(private readonly env: Record<string, string | undefined>) {}

  /** A string; `fallback` when unset or empty, a problem when required. */
  string(name: string, fallback?: string): string {
    const value = this.raw(name);
    if (value) return value;
    if (fallback === undefined) {
      this.problems.push(`${name} is required`);
      return "";
    }
    return fallback;
  }

  /** A string that may be absent. */
  optional(name: string): string | undefined {
    return this.raw(name);
  }

  /** A TCP port. */
  port(name: string, fallback: number): number {
    const raw = this.optional(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      this.problems.push(`${name} must be a port number, got "${raw}"`);
      return fallback;
    }
    return value;
  }

  /** "true" or "false". */
  boolean(name: string, fallback: boolean): boolean {
    const raw = this.optional(name);
    if (raw === undefined) return fallback;
    if (raw === "true" || raw === "false") return raw === "true";
    this.problems.push(`${name} must be "true" or "false", got "${raw}"`);
    return fallback;
  }

  /** One of `allowed`. */
  oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
    const raw = this.optional(name);
    if (raw === undefined) return fallback;
    if ((allowed as readonly string[]).includes(raw)) return raw as T;
    this.problems.push(
      `${name} must be one of ${allowed.join(", ")}, got "${raw}"`,
    );
    return fallback;
  }

  /** A comma-separated list. */
  list(name: string, fallback: string[]): string[] {
    const raw = this.optional(name);
    if (raw === undefined) return fallback;
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /** `NAME`, or the contents of the file `NAME_FILE` names; trimmed. */
  private raw(name: string): string | undefined {
    const value = this.env[name]?.trim() || undefined;
    const path = this.env[`${name}_FILE`]?.trim() || undefined;
    if (path === undefined) return value;
    if (value !== undefined) {
      this.problems.push(`${name} and ${name}_FILE are both set; use one`);
      return value;
    }
    try {
      return readFileSync(path, "utf8").trim() || undefined;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "unreadable";
      this.problems.push(`${name}_FILE: cannot read ${path} (${code})`);
      return undefined;
    }
  }
}
