import { vi } from "vitest";
import type { MediaApi } from "../../src/api/MediaApi";
import type { MetadataApi } from "../../src/api/MetadataApi";
import type { NotificationApi } from "../../src/api/NotificationApi";
import type {
  NewznabItem,
  NzbGeekClient,
} from "../../src/search/services/NzbGeekClient";

export const PAST = "2000-01-01T00:00:00.000Z";
export const FUTURE = "2999-01-01T00:00:00.000Z";

export const fakeMediaApi = () => ({
  createMediaAssetSearchExecution: vi.fn(async () => ({ id: "execution-1" })),
  updateMediaAssetSearchExecution: vi.fn(async () => ({})),
  getMediaAssetSearchConfigurationsRunningCount: vi.fn(async () => 0),
  updateMediaAssetSearchConfiguration: vi.fn(async () => ({
    decoration: { title: "Decorated" },
  })),
  describeMediaAssetSearchConfiguration: vi.fn(
    async (_type: string, _mediaId: number): Promise<unknown> => undefined,
  ),
  describeMediaAssetSearchResult: vi.fn(
    async (_type: string, _mediaId: number, _guid: string): Promise<unknown> =>
      undefined,
  ),
  createMediaAssetSearchResult: vi.fn(async () => ({})),
  createMediaAssetSearchConfiguration: vi.fn(async () => ({})),
  listMediaAssetSearchConfigurations: vi.fn(async (): Promise<unknown[]> => []),
});

export const fakeMetadataApi = () => ({
  describeMovie: vi.fn(async (): Promise<unknown> => ({ externalIds: [] })),
  describeTvSeries: vi.fn(async (): Promise<unknown> => ({})),
  describeTvSeason: vi.fn(async (): Promise<unknown> => ({})),
  describeTvEpisode: vi.fn(async (): Promise<unknown> => ({})),
});

export const fakeNotificationApi = () => ({
  sendNotification: vi.fn(async () => ({})),
});

export const fakeNzbGeek = () => ({
  searchMovie: vi.fn(async (): Promise<unknown> => ({
    status: 200,
    data: { channel: {} },
  })),
  searchTvEpisode: vi.fn(async (): Promise<unknown> => ({
    status: 200,
    data: { channel: {} },
  })),
});

export const fakeAmqp = () => ({
  publish: vi.fn(
    async (
      _exchange: string,
      _routingKey: string,
      _message: unknown,
      _options?: unknown,
    ) => true,
  ),
});

export type Fakes = {
  mediaApi: ReturnType<typeof fakeMediaApi>;
  metadataApi: ReturnType<typeof fakeMetadataApi>;
  notificationApi: ReturnType<typeof fakeNotificationApi>;
  nzbGeek: ReturnType<typeof fakeNzbGeek>;
  amqp: ReturnType<typeof fakeAmqp>;
};

export const fakes = (): Fakes => ({
  mediaApi: fakeMediaApi(),
  metadataApi: fakeMetadataApi(),
  notificationApi: fakeNotificationApi(),
  nzbGeek: fakeNzbGeek(),
  amqp: fakeAmqp(),
});

/** The fakes as the handlers' constructor parameter types. */
export const as = {
  mediaApi: (f: Fakes) => f.mediaApi as unknown as MediaApi,
  metadataApi: (f: Fakes) => f.metadataApi as unknown as MetadataApi,
  notificationApi: (f: Fakes) =>
    f.notificationApi as unknown as NotificationApi,
  nzbGeek: (f: Fakes) => f.nzbGeek as unknown as NzbGeekClient,
  amqp: <T>(f: Fakes) => f.amqp as unknown as T,
};

/** A newznab release with the attributes the handlers read. */
export const release = (
  guid: string,
  title = "The.Matrix.1999.1080p.BluRay.x264-SPARKS",
  attributes: Record<string, string> = {
    guid,
    size: "1000",
    password: "0",
    usenetdate: "Sat, 01 Jan 2022 00:00:00 +0000",
  },
): NewznabItem => ({
  title,
  attr: Object.entries(attributes).map(([name, value]) => ({
    "@attributes": { name, value },
  })),
});

/** The last update of the search execution. */
export const executionUpdate = (f: Fakes) =>
  f.mediaApi.updateMediaAssetSearchExecution.mock.lastCall as unknown as [
    string,
    number,
    string,
    Record<string, unknown>,
  ];
