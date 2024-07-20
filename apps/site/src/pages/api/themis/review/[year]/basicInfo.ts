import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { ReviewYear } from "../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../utils/themis";

export type UpsertReviewYearBasicInfoRequest = {
  review: {
    users: string[];
  };
};

export type ReviewYearBasicInfoResponse = {
  review: ReviewYear;
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

    const response: ReviewYearBasicInfoResponse = {
      review: safeLoadJson<ReviewYear>(reviewDataPath)!,
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    if (!fs.existsSync(reviewPath)) {
      fs.mkdirSync(reviewPath);
    }

    const newReviewYear = req.body as UpsertReviewYearBasicInfoRequest;

    fs.writeFileSync(
      reviewDataPath,
      JSON.stringify(newReviewYear.review, null, 2),
    );

    res.status(200).json({
      review: newReviewYear,
    });
    return;
  }

  res.status(501).end();
}
