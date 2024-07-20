import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import * as fs from "node:fs";
import type {
  BasicUserInfo,
  ReviewYear,
  ReviewYearUsers,
} from "../../../types/themis";
import { p, safeLoadJson } from "../../../utils/themis";

export type GetReviewYearsResponse = {
  reviews: ReviewYear[];
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetReviewYearsResponse>,
) {
  const yearsPath = p("years");

  if (req.method?.toUpperCase() === "GET") {
    if (!fs.existsSync(yearsPath)) {
      res.status(404).end();
      return;
    }

    const years = fs.readdirSync(yearsPath).map((year) => {
      const stat = fs.statSync(`${yearsPath}/${year}`);
      return stat.isDirectory() ? year : undefined;
    });

    const response: GetReviewYearsResponse = { reviews: [] };

    years.forEach((year) => {
      if (!year) {
        return;
      }

      const reviewDataPath = p(`years/${year}/review.json`);

      if (!fs.existsSync(reviewDataPath)) {
        return;
      }

      const reviewYear = safeLoadJson<ReviewYearUsers>(reviewDataPath);

      if (reviewYear && reviewYear.users?.length > 0) {
        response.reviews.push({
          year: year,
          ratingsComplete: 0,
          users: reviewYear.users.map((user) => {
            return safeLoadJson<BasicUserInfo>(
              p(`users/${user}/basicInfo.json`),
              {
                username: user,
                hireDate: DateTime.now().toISODate(),
                givenName: "Unknown",
                surname: "Unknown",
              },
            )!;
          }),
        });
      }
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
