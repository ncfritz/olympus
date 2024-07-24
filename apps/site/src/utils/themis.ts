import * as fs from "node:fs";
import {DATA_PATHS, type UserDataSummary} from "../types/themis";

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

export const getUserDataSummary = (username: string, year: string): UserDataSummary => {
  const userDataPath = p(`users/${username}/data/${year}`);

  const summary: UserDataSummary = {
    jobInfo: false,
    performance: false,
    jobHistory: false,
    forteHistory: false,
    notes: false,
    mentorship: false,
    code: false,
    cr: false,
    sim: false,
    hiring: false,
    bbCard: false,
  };

  Object.entries(DATA_PATHS).forEach(([key, value]) => {
    summary[key as keyof UserDataSummary] = fs.existsSync(
      `${userDataPath}/${value}`,
    );
  });

  return summary;
};
