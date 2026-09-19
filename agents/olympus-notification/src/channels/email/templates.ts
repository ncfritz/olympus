import * as fs from "node:fs";
import * as path from "node:path";

/**
 * The package's `templates/` directory: next to the bundle in dist/ (webpack
 * copies it there) or at the package root when running from source (tests).
 * Found from this file's location, so the working directory doesn't matter.
 */
export const findTemplatesDir = (from: string = __dirname): string => {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "templates");
    if (fs.existsSync(path.join(candidate, "partials", "email"))) {
      return candidate;
    }
    if (path.dirname(dir) === dir) {
      throw new Error(`No templates/ directory above ${from}`);
    }
  }
};
