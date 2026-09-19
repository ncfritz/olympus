/**
 * Reads typed values from environment variables, collecting every problem
 * so a misconfigured deployment is reported in one go at boot.
 */
export class EnvReader {
  readonly problems: string[] = [];

  constructor(private readonly env: Record<string, string | undefined>) {}

  /** A string; `fallback` when unset or empty, a problem when required. */
  string(name: string, fallback?: string): string {
    const value = this.env[name]?.trim();
    if (value) return value;
    if (fallback === undefined) {
      this.problems.push(`${name} is required`);
      return "";
    }
    return fallback;
  }

  /** A string that may be absent. */
  optional(name: string): string | undefined {
    return this.env[name]?.trim() || undefined;
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
}
