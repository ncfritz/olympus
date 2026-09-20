import type { MetadataFetchJob } from "@ncfritz/olympus-sdk/dionysus";
import { vi } from "vitest";

export const PAST = "2000-01-01T00:00:00.000Z";

/** A metadata fetch job, as the API returns it. */
export const fetchJob = (
  overrides: Partial<MetadataFetchJob> = {},
): MetadataFetchJob =>
  ({
    id: "603",
    type: "movies",
    status: "queued",
    ttl: 30,
    jitter: 0,
    lastFetchedTime: undefined,
    ...overrides,
  }) as MetadataFetchJob;

/** A FetchJobStore over a map, recording writes. */
export const fakeStore = (jobs: MetadataFetchJob[] = []) => {
  const byKey = new Map(jobs.map((job) => [`${job.type}:${job.id}`, job]));
  return {
    getMetadataFetchJob: vi.fn(
      async (id: string, type: string, _bypassCache: boolean) =>
        byKey.get(`${type}:${id}`),
    ),
    createMetadataFetchJob: vi.fn(
      async (
        id: string,
        type: string,
        ttl: number,
        jitter: number,
        status: string,
        _publish: boolean,
        _context?: Record<string, unknown>,
      ) => fetchJob({ id, type, ttl, jitter, status } as never),
    ),
    updateMetadataFetchJob: vi.fn(
      async (
        id: string,
        type: string,
        updates: Partial<MetadataFetchJob>,
        _publish: boolean,
        _bypassCache?: boolean,
      ) => fetchJob({ id, type, ...updates } as never),
    ),
  };
};

export type FakeStore = ReturnType<typeof fakeStore>;

/** FetchJobs handing out `store`. */
export const fakeFetchJobs = (store: FakeStore) => ({
  store: vi.fn(async () => store),
});

export const fakeMetadataApi = () =>
  new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (target, name: string) =>
      (target[name] ??= vi.fn(async (...args: unknown[]) => args.at(-1))),
  });

export const fakeJobApi = () => ({
  describeBatchJob: vi.fn(async (id: string) => ({
    id,
    type: "movies",
    status: "created",
  })),
  updateBatchJob: vi.fn(async (_id: string, job: object) => ({ ...job })),
  scrollMetadataFetchJobs: vi.fn(),
});

export const fakeWorkflowApi = () => ({
  updateMetadataWorkflow: vi.fn(async (id: string, workflow: object) => ({
    id,
    ...workflow,
  })),
  createMetadataWorkflowStep: vi.fn(async () => ({})),
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

export const fakeNotifier = () => ({
  sendWorkflowNotification: vi.fn(async () => {}),
  sendBatchJobNotification: vi.fn(async () => {}),
});
