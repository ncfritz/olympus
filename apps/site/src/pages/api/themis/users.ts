import type { NextApiRequest, NextApiResponse } from "next";
import * as fs from "node:fs";
import type { BasicUserInfo } from "../../../types/themis";
import { p, safeLoadJson } from "../../../utils/themis";

export type CreateUserRequest = {
  user: BasicUserInfo;
};
export type CreateUserResponse = CreateUserRequest;

export type ListUsersResponse = {
  users: BasicUserInfo[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method?.toUpperCase() === "GET") {
    const usersPath = p("users");

    if (!fs.existsSync(usersPath)) {
      res.status(404).end();
      return;
    }

    const users: BasicUserInfo[] = fs
      .readdirSync(usersPath)
      .filter((username) => {
        return username !== ".DS_Store";
      })
      .map((username) => {
        return safeLoadJson<BasicUserInfo>(
          `${usersPath}/${username}/basicInfo.json`,
        )!;
      });

    const response = {
      users: users,
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "POST") {
    const userInfo = req.body as BasicUserInfo;
    const userPath = p(`users/${userInfo.username}/basicInfo.json`);

    if (fs.existsSync(userPath)) {
      res.status(409).json({});
      return;
    }

    if (!fs.existsSync(p(`users/${userInfo.username}`))) {
      fs.mkdirSync(p(`users/${userInfo.username}`));
    }

    fs.writeFileSync(userPath, JSON.stringify(userInfo, null, 2));

    res.status(201).json({ user: userInfo });
    return;
  }

  res.status(501).end();
}
