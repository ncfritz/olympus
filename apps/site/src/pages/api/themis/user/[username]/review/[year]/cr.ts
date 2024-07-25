import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { CRStat } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type CRReviewStatsResponse = {
  stats: Record<string, CRStat[]>;
  team: CRStat[];
  level: CRStat[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username as string;
  const year = req.query.year as string;
  const userDataPath = p(`users/${username}/data/${year}`);

  try {
    if (!fs.existsSync(userDataPath)) {
      res.status(404).end();
      return;
    }

    if (req.method?.toUpperCase() === "GET") {
      const targetYear = parseInt(year);
      const reviewYears = [targetYear - 1, targetYear - 2];
      const response: CRReviewStatsResponse = {
        stats: {},
        level: [],
        team: [],
      };

      reviewYears.forEach((reviewYear) => {
        const crStatisticsDataPath = p(
          `users/${username}/data/${reviewYear}/cr.json`,
        );

        if (req.method?.toUpperCase() === "GET") {
          response.stats[reviewYear.toString()] = safeLoadJson<CRStat[]>(
            crStatisticsDataPath,
            [],
          )!;
        }
      });

      res.status(200).json(response);
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(200).end();
    return;
  }

  res.status(501).end();
}
