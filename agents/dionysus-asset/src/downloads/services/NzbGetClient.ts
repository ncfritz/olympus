import { Inject, Injectable } from "@nestjs/common";
import axios from "axios";
import { downloadsConfig } from "../../config/configuration";
import type { DownloadsConfigType } from "../../config/configuration";

/** A download group, as NZBGet's listgroups reports it. */
export type NzbGetGroup = {
  NZBID: number;
  Status: string;
  FileSizeMB: number;
  RemainingSizeMB: number;
};

/** The JSON-RPC response of an NZBGet call. */
export type NzbGetResponse<T> = {
  status: number;
  data: { result: T; error?: unknown };
};

/** NZBGet's JSON-RPC API (NZBGET_HOST, NZBGET_PORT, credentials). */
@Injectable()
export class NzbGetClient {
  readonly url: string;

  constructor(
    @Inject(downloadsConfig.KEY)
    private readonly downloads: DownloadsConfigType,
  ) {
    const { host, port } = this.downloads.nzbGet;
    this.url = `http://${host}:${port}/jsonrpc`;
  }

  /**
   * Queues an NZB in the `dionysus` category.
   * @returns the NZB's id, or false (or negative) when NZBGet refused it
   */
  append(
    filename: string,
    content: string,
  ): Promise<NzbGetResponse<number | false>> {
    return this.call("append", [
      filename,
      Buffer.from(content).toString("base64"),
      "dionysus",
      0,
      false,
      false,
      "",
      0,
      "SCORE",
      [],
    ]);
  }

  /** The queue. */
  listGroups(): Promise<NzbGetResponse<NzbGetGroup[]>> {
    return this.call("listgroups", [0]);
  }

  /** Removes a finished (or failed) NZB from the history, with its files. */
  deleteHistory(nzbId: number): Promise<NzbGetResponse<boolean>> {
    return this.call("editqueue", ["GroupFinalDelete", 0, "", [nzbId]]);
  }

  private async call<T>(
    method: string,
    params: unknown[],
  ): Promise<NzbGetResponse<T>> {
    const { username, password } = this.downloads.nzbGet;
    const response = await axios.post(
      this.url,
      { id: 1, jsonrpc: "2.0", method, params },
      { auth: { username: username!, password: password! } },
    );
    return { status: response.status, data: response.data };
  }
}
