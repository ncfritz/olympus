/** Thrown by a configuration reader with every invalid or missing variable. */
export class ConfigValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "ConfigValidationError";
  }
}
