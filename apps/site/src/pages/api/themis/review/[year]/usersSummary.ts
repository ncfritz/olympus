import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type {
  BasicUserInfo,
  ReviewRating,
  UserDataSummary,
  UserDataYearsSummary,
} from "../../../../../types/themis";
import {
  getUserDataSummary,
  p,
  safeLoadJson,
} from "../../../../../utils/themis";
import { DEFAULT_RATING } from "../../user/[username]/data/[year]/rating";

export type RawReviewData = {
  users: string[];
};

export type UserReviewSummary = {
  basicInfo: BasicUserInfo;
  dataSummary: UserDataSummary;
  pastDataSummary: UserDataYearsSummary;
  rating: ReviewRating;
  bbCard: boolean;
};

export type UsersSummaryResponse = {
  users: UserReviewSummary[];
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

    const response: UsersSummaryResponse = {
      users: [],
    };

    const reviewDefinition = safeLoadJson<RawReviewData>(reviewDataPath, {
      users: [],
    })!;

    reviewDefinition.users.forEach((username) => {
      const userInfoPath = p(`users/${username}/basicInfo.json`);
      const userRatingPath = p(`users/${username}/data/${year}/rating.json`);
      const currentYear = parseInt(year);
      const dataSummary: UserDataYearsSummary = {
        jobInfo: [],
        performance: [],
        jobHistory: [],
        forteHistory: [],
        notes: [],
        mentorship: [],
        code: [],
        cr: [],
        sim: [],
        hiring: [],
        bbCard: [],
      };

      for (let i = 1; i <= 4; i++) {
        const targetYear = (currentYear - i).toString();
        const yearDataSummary = getUserDataSummary(username, targetYear);

        Object.keys(dataSummary).forEach((key: keyof UserDataYearsSummary) => {
          if (yearDataSummary[key]) {
            dataSummary[key].push(targetYear);
          }
        });
      }

      const userDataSummary = getUserDataSummary(username, year);

      response.users.push({
        basicInfo: safeLoadJson<BasicUserInfo>(userInfoPath)!,
        dataSummary: userDataSummary,
        pastDataSummary: dataSummary,
        rating: safeLoadJson<ReviewRating>(userRatingPath, DEFAULT_RATING)!,
        bbCard: false,
      });
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
