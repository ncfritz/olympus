import type {
  RequestMetrics,
  RequestObservation,
} from "@ncfritz/olympus-metrics";
import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { vi } from "vitest";
import { createOlympusClients } from "../../src";

export type SentRequest = {
  method: string;
  url: string;
  headers: Record<string, unknown>;
  body: unknown;
};

type Reply = { status: number; data?: unknown } | Error;

/** Olympus clients over a fake transport that records requests and plays replies. */
export const fakeApi = (baseUrl = "http://olympus-api:3100/v1") => {
  const sent: SentRequest[] = [];
  const observed: RequestObservation[] = [];
  const replies: Reply[] = [];

  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    sent.push({
      method: (config.method ?? "").toUpperCase(),
      url: config.url ?? "",
      headers: { ...config.headers },
      body:
        typeof config.data === "string" ? JSON.parse(config.data) : config.data,
    });
    const reply = replies.shift() ?? { status: 200, data: {} };
    if (reply instanceof Error) {
      throw new AxiosError(reply.message, "ECONNREFUSED", config);
    }
    const response = {
      data: reply.data ?? {},
      status: reply.status,
      statusText: String(reply.status),
      headers: {},
      config,
      request: {},
    };
    const valid = config.validateStatus
      ? config.validateStatus(reply.status)
      : true;
    if (!valid) {
      throw new AxiosError(
        `Request failed with status code ${reply.status}`,
        "ERR_BAD_RESPONSE",
        config,
        {},
        response,
      );
    }
    return response;
  };

  const metrics: RequestMetrics = {
    observeClientRequest: vi.fn((o) => observed.push(o)),
    observeServerRequest: vi.fn(),
  };

  const clients = createOlympusClients({
    baseUrl,
    clientName: "test-agent",
    metrics,
    axios: { adapter },
  });

  return {
    clients,
    sent,
    observed,
    /** Queues the reply to the next request. */
    reply: (status: number, data?: unknown) => replies.push({ status, data }),
    fail: (message: string) => replies.push(new Error(message)),
  };
};
