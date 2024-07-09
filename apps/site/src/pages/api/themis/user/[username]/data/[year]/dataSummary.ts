import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { ReviewRating } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type DataSummaryResponse = {
  jobInfo: boolean;
  performance: boolean;
  jobHistory: boolean;
  notes: boolean;
  mentorship: boolean;
  code: boolean;
  tt: boolean;
  sim: boolean;
  hiring: boolean;
};

const DATA_PATHS: Record<keyof DataSummaryResponse, string> = {
  jobInfo: "jobInfo.json",
  performance: "rating.json",
  jobHistory: "jobHistory.json",
  notes: "notes.json",
  mentorship: "mentorship.json",
  code: "code.json",
  tt: "tt.json",
  sim: "sim.json",
  hiring: "hiring.json",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  if (req.method?.toUpperCase() === "GET") {
    const response: DataSummaryResponse = {
      jobInfo: false,
      performance: false,
      jobHistory: false,
      notes: false,
      mentorship: false,
      code: false,
      tt: false,
      sim: false,
      hiring: false,
    };

    Object.entries(DATA_PATHS).forEach(([key, value]) => {
      response[key as keyof DataSummaryResponse] = fs.existsSync(
        `${userDataPath}/${value}`,
      );
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
