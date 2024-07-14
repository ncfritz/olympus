import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { ForteSummary } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";
import { EMPTY_FORTE_SUMMARY } from "../../../../../../../utils/themisData";

export type UpsertForteSummaryRequest = {
  summary: ForteSummary;
};

export type ForteSummaryResponse = {
  summary: ForteSummary;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const forteDataPath = p(`users/${username}/data/${year}/forte.json`);

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      summary: safeLoadJson<ForteSummary>(forteDataPath, EMPTY_FORTE_SUMMARY),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const forteSummary = req.body as UpsertForteSummaryRequest;

    fs.writeFileSync(
      forteDataPath,
      JSON.stringify(forteSummary.summary, null, 2),
    );

    res.status(200).json(forteSummary);
    return;
  }

  res.status(501).end();
}
