import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { CodeStat } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type CodeStatsReviewResponse = {
  stats: Record<string, CodeStat[]>;
  team: CodeStat[];
  level: CodeStat[];
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
      const response: CodeStatsReviewResponse = {
        stats: {},
        level: [],
        team: [],
      };

      reviewYears.forEach((reviewYear) => {
        const codeStatisticsDataPath = p(
          `users/${username}/data/${reviewYear}/code.json`,
        );

        console.log(codeStatisticsDataPath);

        if (req.method?.toUpperCase() === "GET") {
          response.stats[reviewYear.toString()] = safeLoadJson<CodeStat[]>(
            codeStatisticsDataPath,
            [],
          )!;
        }
      });

      res.status(200).json(response);
      return;
    }
  } catch (e) {
    console.log(e);
  }

  res.status(501).end();
}
