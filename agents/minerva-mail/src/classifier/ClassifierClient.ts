import { Inject, Injectable } from "@nestjs/common";
import axios, { type AxiosInstance } from "axios";
import * as fs from "fs";
import * as https from "https";
import {
  classifierConfig,
  type ClassifierConfigType,
} from "../config/configuration";

/** One message as the classifier featurizes it. Its text lives only here. */
export type ClassifierMessage = {
  gmailId: string;
  receivedAt: string;
  subject: string | null;
  text: string | null;
  fromAddress: string | null;
  listId: string | null;
  hasListUnsubscribe: boolean;
  attachmentExtensions: string[];
};

export type FeatureVersion = {
  version: string;
  status: "building" | "ready";
  nFeatures: number;
  messages: number;
  createdTime: string;
  completedTime?: string | null;
  serving: boolean;
};

/**
 * The classifier's services listener (agents/minerva-mail-ml), reached
 * with this agent's certificate (ADR 0030). The only way text leaves the
 * agent: in the body of a request over mutual TLS, held for that request.
 */
@Injectable()
export class ClassifierClient {
  private readonly http?: AxiosInstance;

  constructor(@Inject(classifierConfig.KEY) config: ClassifierConfigType) {
    if (!config?.tls || !config.baseUrl) return;
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      // One handshake, then every batch reuses the connection.
      httpsAgent: new https.Agent({
        keepAlive: true,
        cert: fs.readFileSync(config.tls.certificate),
        key: fs.readFileSync(config.tls.key),
        ca: config.tls.ca ? fs.readFileSync(config.tls.ca) : undefined,
      }),
      // A batch of text is large; the classifier caps it, not the client.
      maxBodyLength: Infinity,
      maxContentLength: 10 * 1024 * 1024,
    });
  }

  get configured(): boolean {
    return this.http !== undefined;
  }

  /** Featurizes a batch; the classifier answers the version it built. */
  async putFeatures(
    accountId: string,
    messages: ClassifierMessage[],
  ): Promise<{ version: string; stored: number }> {
    return (
      await this.client().post<{ version: string; stored: number }>(
        "/features",
        { accountId, messages },
      )
    ).data;
  }

  /** The versions in the classifier's store. */
  async listFeatureVersions(): Promise<FeatureVersion[]> {
    return (await this.client().get<FeatureVersion[]>("/features/versions"))
      .data;
  }

  /** Marks a feature version built, so it serves. */
  async completeFeatures(version: string): Promise<FeatureVersion> {
    return (
      await this.client().post<FeatureVersion>("/features/complete", {
        version,
      })
    ).data;
  }

  private client(): AxiosInstance {
    if (!this.http) {
      throw new Error(
        "The classifier is not configured: set MAIL_ML_URL and the agent's certificate",
      );
    }
    return this.http;
  }
}
