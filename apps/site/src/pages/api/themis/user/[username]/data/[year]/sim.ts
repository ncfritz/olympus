import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { SimStat } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertSimStatsRequest = {
  stats: SimStat[];
};

export type SimStatsResponse = {
  stats: SimStat[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const simStatisticsDataPath = p(`users/${username}/data/${year}/sim.json`);

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      stats: safeLoadJson<SimStat[]>(simStatisticsDataPath, []),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newEntries = req.body as UpsertSimStatsRequest;

    fs.writeFileSync(
      simStatisticsDataPath,
      JSON.stringify(newEntries.stats, null, 2),
    );

    res.status(200).json({
      stats: newEntries,
    });
    return;
  }

  res.status(501).end();
}
