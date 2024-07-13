import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { CRStat } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertCodeStatsRequest = {
  stats: CRStat[];
};

export type JCodeStatsResponse = {
  stats: CRStat[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const codeReviewStatisticsDataPath = p(
    `users/${username}/data/${year}/cr.json`,
  );

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      stats: safeLoadJson<CRStat[]>(codeReviewStatisticsDataPath, []),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newEntries = req.body as UpsertCodeStatsRequest;

    console.log(newEntries);

    fs.writeFileSync(
      codeReviewStatisticsDataPath,
      JSON.stringify(newEntries.stats, null, 2),
    );

    res.status(200).json({
      stats: newEntries,
    });
    return;
  }

  res.status(501).end();
}
