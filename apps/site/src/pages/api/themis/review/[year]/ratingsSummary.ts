import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type {ReviewRating, ReviewYear} from "../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../utils/themis";

export type RawReviewData = {
  users: string[];
}

export type AllowedOV = "LE" | "HV1" | "HV2" | "HV3" | "TT";

export type ReviewRatingsSummaryResponse = {
  distribution: {
    LE: number;
    HV1: number;
    HV2: number;
    HV3: number;
    TT: number;
  };
};


export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const year = req.query.year;
  const reviewPath = p(`years/${year}`);
  const reviewDataPath = `${reviewPath}/review.json`;

  if (req.method?.toUpperCase() === "GET") {
    if (!fs.existsSync(reviewDataPath)) {
      res.status(404).end();
      return;
    }

    const response: ReviewRatingsSummaryResponse = {
      distribution: {
        LE: 0,
        HV1: 0,
        HV2: 0,
        HV3: 0,
        TT: 0,
      }
    };

    const reviewDefinition = safeLoadJson<RawReviewData>(reviewDataPath, { users: []  })!;

    reviewDefinition.users.forEach((username) => {
      const ratingPath = p(`users/${username}/data/${year}/rating.json`);
      const rating = safeLoadJson<ReviewRating>(ratingPath);

      if (rating && rating.overall !== "NA" && rating.overall !== "Unknown") {
        response.distribution[rating.overall as AllowedOV]++;
      }
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
