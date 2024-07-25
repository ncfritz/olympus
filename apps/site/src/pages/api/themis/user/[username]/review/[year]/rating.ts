import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type {
  ExtendedReviewRating,
  ReviewRating,
} from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertRatingRequest = {
  rating: ReviewRating;
};

export type ReviewRatingResponse = {
  current: ExtendedReviewRating;
  past?: ExtendedReviewRating[];
};

export const DEFAULT_RATING: ReviewRating = {
  growth: "Unknown",
  overall: "Unknown",
  performance: "Unknown",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username as string;
  const year = req.query.year as string;
  const userDataPath = p(`users/${username}/data`);
  const userDataYearPath = `${userDataPath}/${year}`;

  if (!fs.existsSync(userDataYearPath)) {
    res.status(404).end();
    return;
  }

  const ratingDataPath = `${userDataYearPath}/rating.json`;

  if (req.method?.toUpperCase() === "GET") {
    const currentRating = safeLoadJson<ReviewRating>(
      ratingDataPath,
      DEFAULT_RATING,
    );
    let pastReviews: ExtendedReviewRating[] = [];

    const years = fs.readdirSync(userDataPath).map((year) => {
      const stat = fs.statSync(`${userDataPath}/${year}`);
      return stat.isDirectory() ? year : undefined;
    });

    pastReviews = [];

    years.forEach((candidateYear) => {
      if (candidateYear! < year!) {
        try {
          const candidateRating = safeLoadJson<ReviewRating>(
            `${userDataPath}/${candidateYear}/rating.json`,
          );

          if (candidateRating) {
            pastReviews!.push({
              ...candidateRating,
              quarter: "4",
              focal: true,
              year: candidateYear!,
            });
          }
        } catch (e) {
          console.log(e);
        }
      }
    });

    const response: ReviewRatingResponse = {
      current: {
        ...currentRating!,
        year: year as string,
        focal: true,
        quarter: "4",
      },
      past: pastReviews,
    };

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
