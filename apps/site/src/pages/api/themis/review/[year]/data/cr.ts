import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { CRStat } from "../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../utils/themis";
import type { RawReviewData } from "../usersSummary";

export type ReviewYearCRResponse = {
  userStats: Record<string, CRStat[]>;
  team: {
    average: CRStat[];
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

    const userStats: Record<string, CRStat[]> = {};
    const teamAverage: CRStat[] = new Array(53);

    review.users.forEach((username) => {
      const userDataPath = p(`users/${username}/data/${targetYear}/cr.json`);
      const userCodeStats = safeLoadJson<CRStat[]>(userDataPath, [])!;

      userStats[username] = userCodeStats;

      userCodeStats?.forEach((crStat) => {
        if (!teamAverage[crStat.week - 1]) {
          teamAverage[crStat.week - 1] = {
            week: crStat.week,
            authored: 0,
            received: 0,
            commented: 0,
            approved: 0,
          };
        }

        teamAverage[crStat.week - 1].authored += crStat.authored;
        teamAverage[crStat.week - 1].received += crStat.received;
        teamAverage[crStat.week - 1].commented += crStat.commented;
        teamAverage[crStat.week - 1].approved += crStat.approved;
      });
    });

    teamAverage.forEach((crStat, index) => {
      teamAverage[index].authored = crStat.authored / review.users.length;
      teamAverage[index].received = crStat.received / review.users.length;
      teamAverage[index].commented = crStat.commented / review.users.length;
      teamAverage[index].approved = crStat.approved / review.users.length;
    });

    const response: ReviewYearCRResponse = {
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
