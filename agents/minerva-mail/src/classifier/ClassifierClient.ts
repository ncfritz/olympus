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

/** A label the serving model suggests for a message, best first. */
export type ClassifierSuggestion = {
  label: string;
  /** `topic`, or `family` (the label is the family's initial state). */
  kind: string;
  score: number;
  threshold?: number | null;
  ticked: boolean;
};

/** Messages scored by the account's serving model. */
export type ClassifierSuggestions = {
  modelRun: string;
  featureVersion: string;
  messages: { gmailId: string; labels: ClassifierSuggestion[] }[];
};

export type EmbeddingVersion = {
  version: string;
  model: string;
  dims: number;
  status: "building" | "ready";
  messages: number;
  createdTime: string;
  completedTime?: string | null;
  serving: boolean;
};

/** Featurized mail without a vector in the classifier's embedding version. */
export type MissingEmbeddings = {
  version: string;
  /** How many of the account's messages have none. */
  missing: number;
  /** The newest of them, at most the limit asked for. */
  gmailIds: string[];
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

  /**
   * Scores messages with the account's serving model; the text is used for
   * that request and stored nowhere. Undefined while no model is trained
   * for the account (the classifier's 404).
   */
  async suggest(
    accountId: string,
    messages: ClassifierMessage[],
  ): Promise<ClassifierSuggestions | undefined> {
    try {
      return (
        await this.client().post<ClassifierSuggestions>("/suggestions", {
          accountId,
          messages,
        })
      ).data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /** Embeds a batch for the embedding version being built (phase 6). */
  async putEmbeddings(
    accountId: string,
    messages: ClassifierMessage[],
  ): Promise<{ version: string; stored: number }> {
    return (
      await this.client().post<{ version: string; stored: number }>(
        "/embeddings",
        { accountId, messages },
      )
    ).data;
  }

  /**
   * The account's messages the classifier featurized but has no vector
   * for, newest first, at most `limit`: mail that came while the
   * embedding model was down. Undefined when the classifier has no
   * embedding model (its 503).
   */
  async listMissingEmbeddings(
    accountId: string,
    limit: number,
  ): Promise<MissingEmbeddings | undefined> {
    try {
      return (
        await this.client().get<MissingEmbeddings>("/embeddings/missing", {
          params: { accountId, limit },
        })
      ).data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 503) {
        return undefined;
      }
      throw error;
    }
  }

  /** Marks an embedding version built, so training uses it. */
  async completeEmbeddings(version: string): Promise<EmbeddingVersion> {
    return (
      await this.client().post<EmbeddingVersion>("/embeddings/complete", {
        version,
      })
    ).data;
  }

  /** The embedding versions in the classifier's store. */
  async listEmbeddingVersions(): Promise<EmbeddingVersion[]> {
    return (await this.client().get<EmbeddingVersion[]>("/embeddings/versions"))
      .data;
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
