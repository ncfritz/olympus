import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import { getUserDataSummary, p } from "../../../../../../../utils/themis";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username as string;
  const year = req.query.year as string;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  if (req.method?.toUpperCase() === "GET") {
    res.status(200).json(getUserDataSummary(username, year));
    return;
  }

  res.status(501).end();
}
