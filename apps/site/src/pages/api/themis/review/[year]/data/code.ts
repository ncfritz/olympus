import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { CodeStat } from "../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../utils/themis";
import type { RawReviewData } from "../usersSummary";

export type ReviewYearCodeResponse = {
  userStats: Record<string, CodeStat[]>;
  team: {
    average: CodeStat[];
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const year = req.query.year as string;
  const reviewPath = p(`years/${year}`);
  const reviewDataPath = `${reviewPath}/review.json`;

  if (req.method?.toUpperCase() === "GET") {
    if (!fs.existsSync(reviewDataPath)) {
      res.status(404).end();
      return;
    }

    const review = safeLoadJson<RawReviewData>(reviewDataPath)!;
    const targetYear = parseInt(year) - 1;

    const userStats: Record<string, CodeStat[]> = {};
    const teamAverage: CodeStat[] = new Array(53);

    review.users.forEach((username) => {
      const userDataPath = p(`users/${username}/data/${targetYear}/code.json`);
      const userCodeStats = safeLoadJson<CodeStat[]>(userDataPath, [])!;

      userStats[username] = userCodeStats;

      userCodeStats?.forEach((codeStat) => {
        if (!teamAverage[codeStat.week - 1]) {
          teamAverage[codeStat.week - 1] = {
            week: codeStat.week,
            added: 0,
            removed: 0,
            changes: 0,
            packages: 0,
          };
        }

        teamAverage[codeStat.week - 1].added += codeStat.added;
        teamAverage[codeStat.week - 1].removed += codeStat.removed;
        teamAverage[codeStat.week - 1].changes += codeStat.changes;
        teamAverage[codeStat.week - 1].packages += codeStat.packages;
      });
    });

    teamAverage.forEach((codeStat, index) => {
      teamAverage[index].added = codeStat.added / review.users.length;
      teamAverage[index].removed = codeStat.removed / review.users.length;
      teamAverage[index].changes = codeStat.changes / review.users.length;
      teamAverage[index].packages = codeStat.packages / review.users.length;
    });

    const response: ReviewYearCodeResponse = {
      userStats: userStats,
      team: {
        average: teamAverage,
      },
    };

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
