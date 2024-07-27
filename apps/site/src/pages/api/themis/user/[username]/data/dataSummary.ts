import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { UserDataSummary } from "../../../../../../types/themis";
import { getUserDataSummary, p } from "../../../../../../utils/themis";

export type DataSummaryResponse = Record<string, UserDataSummary>;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username as string;
  const userDataPath = p(`users/${username}/data`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  if (req.method?.toUpperCase() === "GET") {
    const response: DataSummaryResponse = {};

    fs.readdirSync(userDataPath).forEach((year) => {
      const userDataYearPath = `${userDataPath}/${year}`;
      const stat = fs.statSync(userDataYearPath);

      if (!stat.isDirectory()) {
        return;
      }

      response[year] = getUserDataSummary(username, year);
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
