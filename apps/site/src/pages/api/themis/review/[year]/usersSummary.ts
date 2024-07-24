import type { NextApiRequest, NextApiResponse } from "next";
import {mockSession} from "next-auth/client/__tests__/helpers/mocks";
import fs from "node:fs";
import type {
  BasicUserInfo,
  ReviewRating,
  ReviewYear,
  UserDataSummary,
  UserDataYearsSummary
} from "../../../../../types/themis";
import {getUserDataSummary, p, safeLoadJson} from "../../../../../utils/themis";
import {DEFAULT_RATING} from "../../user/[username]/data/[year]/rating";
import Review = google.maps.places.Review;

export type RawReviewData = {
  users: string[];
}


export type UserReviewSummary = {
  basicInfo: BasicUserInfo;
  dataSummary: UserDataSummary,
  pastDataSummary: UserDataYearsSummary;
  rating: ReviewRating;
  bbCard: boolean;
}

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

    const reviewDefinition = safeLoadJson<RawReviewData>(reviewDataPath, { users: []  })!;

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

      for (let i = 0; i < 4; i++) {
        const targetYear = (currentYear  - i).toString();
        const yearDataSummary = getUserDataSummary(username, targetYear);
        console.log(year);

        Object.keys(dataSummary).forEach((key: keyof UserDataYearsSummary) => {
          if (yearDataSummary[key]) {
            dataSummary[key].push(targetYear);
          }
        });
      }

      response.users.push({
        basicInfo: safeLoadJson<BasicUserInfo>(userInfoPath)!,
        dataSummary: getUserDataSummary(username, year),
        pastDataSummary: dataSummary,
        rating: safeLoadJson<ReviewRating>(userRatingPath, DEFAULT_RATING)!,
        bbCard: false,
      })
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
