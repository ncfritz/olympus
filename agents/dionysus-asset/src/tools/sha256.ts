import { createHash } from "crypto";
import fs from "fs";

/** The hex SHA-256 of a file; rejects when the file can't be read. */
export const sha256File = async (file: fs.PathLike): Promise<string> => {
  const hash = createHash("sha256");

  for await (const chunk of fs.createReadStream(file)) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
};
