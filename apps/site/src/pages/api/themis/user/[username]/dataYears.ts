import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import { p } from "../../../../../utils/themis";

export type CreateDataYearRequest = {
  year: string;
};

export type DataYearsResponse = {
  years: string[];
};

const buildDataYearsResponse = (path: string): DataYearsResponse => {
  const years: string[] = [];

  fs.readdirSync(path).forEach((year) => {
    const stat = fs.statSync(`${path}/${year}`);

    if (stat.isDirectory()) {
      years.push(year);
    }
  });

  return { years: years };
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const userPath = p(`users/${username}`);
  const userDataPath = p(`users/${username}/data`);

  if (!fs.existsSync(userPath)) {
    res.status(404).end();
    return;
  }

  if (req.method?.toUpperCase() === "GET") {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath);
    }

    res.status(200).json(buildDataYearsResponse(userDataPath));
    return;
  } else if (req.method?.toUpperCase() === "POST") {
    const createRequest = req.body as CreateDataYearRequest;
    const dataPath = `${userDataPath}/${createRequest.year}`;

    if (fs.existsSync(dataPath)) {
      res.status(409).end();
      return;
    }

    fs.mkdirSync(dataPath);

    res.status(201).json(buildDataYearsResponse(userDataPath));
    return;
  }

  res.status(501).end();
}
