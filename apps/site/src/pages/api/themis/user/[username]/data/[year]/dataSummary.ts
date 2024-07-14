import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { UserDataSummary } from "../../../../../../../types/themis";
import { p } from "../../../../../../../utils/themis";
import { DATA_PATHS } from "../../../../../../../types/themis";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  if (req.method?.toUpperCase() === "GET") {
    const response: UserDataSummary = {
      jobInfo: false,
      performance: false,
      jobHistory: false,
      forteHistory: false,
      notes: false,
      mentorship: false,
      code: false,
      cr: false,
      tt: false,
      sim: false,
      hiring: false,
    };

    Object.entries(DATA_PATHS).forEach(([key, value]) => {
      response[key as keyof UserDataSummary] = fs.existsSync(
        `${userDataPath}/${value}`,
      );
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
