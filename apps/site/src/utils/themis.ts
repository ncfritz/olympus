import type { NextApiResponse } from "next";
import * as fs from "node:fs";

export const p = (pathSuffix: string): string => {
  if (!pathSuffix.startsWith("/")) {
    pathSuffix = `/${pathSuffix}`;
  }
  return `${process.env.OLR_ROOT}${pathSuffix}`;
};

export const safeLoadJson = <T>(
  filename: string,
  defaultValue?: T,
): T | undefined => {
  if (!fs.existsSync(filename)) {
    console.error(`\`Could not find path: ${filename}`);

    if (defaultValue) {
      return defaultValue;
    } else {
      throw "NotFound";
    }
  }

  const stat = fs.statSync(filename);

  if (!stat.isFile()) {
    throw "TargetNotAFile";
  }

  try {
    return JSON.parse(fs.readFileSync(filename).toString("utf-8")) as T;
  } catch (e) {
    console.error(`Unable to parse file: ${filename}`, e);
    throw "InvalidJson";
  }
};
