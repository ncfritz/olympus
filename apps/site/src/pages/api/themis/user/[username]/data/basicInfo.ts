import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { BasicUserInfo } from "../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../utils/themis";

export type BasicInfoResponse = {
  basicInfo?: BasicUserInfo;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const userPath = p(`users/${req.query.username}`);
  const userInfoPath = p(`users/${req.query.username}/basicInfo.json`);

  if (!fs.existsSync(userPath)) {
    res.status(404).end();
    return;
  }

  if (req.method?.toUpperCase() === "GET") {
    if (!fs.existsSync(userInfoPath)) {
      res.status(204).end();
      return;
    }

    const response: BasicInfoResponse = {
      basicInfo: safeLoadJson(userInfoPath),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newUserInfo = req.body as BasicUserInfo;
    newUserInfo.username = req.query.username as string;

    fs.writeFileSync(userInfoPath, JSON.stringify(newUserInfo, null, 2));

    const response: BasicInfoResponse = {
      basicInfo: newUserInfo,
    };

    res.status(200).json(response);
  }

  res.status(501).end();
}
