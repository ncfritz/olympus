import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import {
  dionysusConfig,
  DionysusConfigType,
} from "../../../config/configuration";

/**
 * `<random>-<name>` where name is the client's file name reduced to a safe
 * base name, so an upload cannot be written outside the upload directory.
 */
export const storedFilename = (originalName: string): string => {
  const base = path
    .basename(originalName.replace(/\\/g, "/"))
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/^\.+/, "_");
  return `${randomBytes(16).toString("hex")}-${base || "upload"}`;
};

/** Multer storage for UploadAssets: DIONYSUS_UPLOAD_PATH, safe names. */
export const UploadStorageModule = MulterModule.registerAsync({
  inject: [dionysusConfig.KEY],
  useFactory: (dionysus: DionysusConfigType) => ({
    storage: diskStorage({
      destination: dionysus.uploadPath,
      filename: (_req, file, callback) =>
        callback(null, storedFilename(file.originalname)),
    }),
  }),
});
