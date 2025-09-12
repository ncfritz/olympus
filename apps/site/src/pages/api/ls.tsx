import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";

type ListFSContentsRequest = {
  path: string;
  filter?: string[];
  filterMethod: "include" | "exclude";
};

type ListFSContentsRespnse = {
  count: number;
  filtered: number;
  unfiltered: number;
  contents: any[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method?.toUpperCase() === "POST") {
    const request: ListFSContentsRequest = req.body;
    let targetPath = request.path;

    while (targetPath.endsWith("/")) {
      targetPath = targetPath.substring(0, targetPath.length - 1);
    }

    if (!fs.existsSync(targetPath)) {
      res.status(404).end();
      return;
    }

    const response: ListFSContentsRespnse = {
      count: 0,
      filtered: 0,
      unfiltered: 0,
      contents: [],
    };

    const rawContents = fs.readdirSync(request.path);

    rawContents.forEach((entry) => {
      const entryPath = `${targetPath}/${entry}`;
      const stats = fs.statSync(entryPath);
      response.contents.push({
        name: entry,
        path: entryPath,
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
        directory: stats.isDirectory(),
        file: stats.isFile(),
        symlink: stats.isSymbolicLink(),
        blockSize: stats.blksize,
        blocks: stats.blocks,
        size: stats.size,
        lastModified: stats.mtime,
        created: stats.ctime,
        lastAccess: stats.atime,
      });
    });

    res.status(200).json(response);
    return;
  }

  res.status(501).end();
}
