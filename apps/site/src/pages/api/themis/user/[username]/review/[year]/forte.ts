import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { ForteSummary } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";
import { EMPTY_FORTE_SUMMARY } from "../../../../../../../utils/themisData";

export type ForteSummaryReviewResponse = {
  years: Record<string, ForteSummary>;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username as string;
  const year = req.query.year as string;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const reviewYear = parseInt(year);
  const summaries: Record<string, ForteSummary> = {};

  if (req.method?.toUpperCase() === "GET") {
    for (let i = 1; i <= 4; i++) {
      const forteDataPath = p(
        `users/${username}/data/${reviewYear - i}/forte.json`,
      );

      if (fs.existsSync(forteDataPath)) {
        summaries[(reviewYear - i).toString()] = safeLoadJson<ForteSummary>(
          forteDataPath,
          EMPTY_FORTE_SUMMARY,
        )!;
      }
    }

    const response: ForteSummaryReviewResponse = {
      years: summaries,
    };

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
