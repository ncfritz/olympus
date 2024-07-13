import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { UserDataSummary } from "../../../../../../types/themis";
import { p } from "../../../../../../utils/themis";

export type DataSummaryResponse = Record<string, UserDataSummary>;

const DATA_PATHS: Record<keyof DataSummaryResponse, string> = {
  jobInfo: "jobInfo.json",
  performance: "rating.json",
  jobHistory: "jobHistory.json",
  notes: "notes.json",
  mentorship: "mentorship.json",
  code: "code.json",
  cr: "cr.json",
  tt: "tt.json",
  sim: "sim.json",
  hiring: "hiring.json",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
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

      const summary: UserDataSummary = {
        jobInfo: false,
        performance: false,
        jobHistory: false,
        notes: false,
        mentorship: false,
        code: false,
        cr: false,
        tt: false,
        sim: false,
        hiring: false,
      };

      Object.entries(DATA_PATHS).forEach(([key, value]) => {
        summary[key as keyof UserDataSummary] = fs.existsSync(
          `${userDataYearPath}/${value}`,
        );
      });

      response[year] = summary;
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
