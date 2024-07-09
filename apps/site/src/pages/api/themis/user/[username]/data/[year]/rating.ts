import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { ReviewRating } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertRatingRequest = {
  rating: ReviewRating;
};

export type ReviewRatingResponse = {
  rating: ReviewRating;
};

const DEFAULT_RATING: ReviewRating = {
  growth: "Unknown",
  overall: "Unknown",
  performance: "Unknown",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const ratingDataPath = p(`users/${username}/data/${year}/rating.json`);

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      rating: safeLoadJson<ReviewRating>(ratingDataPath, DEFAULT_RATING),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newRating = req.body as UpsertRatingRequest;

    fs.writeFileSync(ratingDataPath, JSON.stringify(newRating.rating, null, 2));

    res.status(200).json({
      rating: newRating,
    });
    return;
  }

  res.status(501).end();
}
