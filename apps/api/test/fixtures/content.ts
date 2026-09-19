/** Hasura rows for Dionysus content tables, plus content-auth helpers. */
import {
  ContentIngestionWorkflowAssetLocation,
  ContentIngestionWorkflowStatus,
  ContentIngestionWorkflowStepStatus,
  ContentIngestionWorkflowStepType,
  ContentTagType,
} from "@ncfritz/olympus-model";
import * as jose from "jose";
import type {
  GraphQLContentAsset,
  GraphQlContentAssetTag,
  GraphQlFullContentAssetChannel,
  GraphQlFullContentAssetChannelCategory,
} from "../../src/dionysus/content/types/content";
import type {
  GraphQLContentIngestionWorkflow,
  GraphQlContentIngestionWorkflowStep,
} from "../../src/dionysus/content/workflows/types/workflow";

export const ASSET_ID = "c0a7e17e-0000-4000-8000-0000000c0001";
export const TAG_ID = "c0a7e17e-0000-4000-8000-0000000c0101";
export const CHANNEL_ID = "c0a7e17e-0000-4000-8000-0000000c0201";
export const CATEGORY_ID = "c0a7e17e-0000-4000-8000-0000000c0301";
export const INGEST_ID = "c0a7e17e-0000-4000-8000-0000000c0401";
export const INGEST_STEP_ID = "c0a7e17e-0000-4000-8000-0000000c0501";

const times = {
  createdTime: "2026-09-18T10:00:00Z",
  lastUpdatedTime: "2026-09-18T10:05:00Z",
};

export const graphQlContentTag = (
  overrides: Partial<GraphQlContentAssetTag> = {},
): GraphQlContentAssetTag => ({
  content_tag_id: TAG_ID,
  name: "beach",
  type: ContentTagType.USER,
  createdTime: "2026-09-01T00:00:00Z",
  ...overrides,
});

export const graphQlContentAsset = (
  overrides: Partial<GraphQLContentAsset> = {},
): GraphQLContentAsset => ({
  content_id: ASSET_ID,
  asset_sha: "new-sha",
  asset_size: 1_000_000,
  duration: 60_000,
  height: 1080,
  width: 1920,
  original_name: "clip.mov",
  original_sha: "orig-sha",
  original_size: 2_000_000,
  createdTime: "2026-09-18T10:00:00Z",
  name: "clip",
  rating: 4,
  asset_tags: [{ tag: graphQlContentTag() }],
  ...overrides,
});

export const graphQlChannelCategory = (
  overrides: Partial<GraphQlFullContentAssetChannelCategory> = {},
): GraphQlFullContentAssetChannelCategory => ({
  id: CATEGORY_ID,
  name: "Travel",
  channels_aggregate: { aggregate: { count: 1 } },
  channels: [],
  ...times,
  ...overrides,
});

export const graphQlChannel = (
  overrides: Partial<GraphQlFullContentAssetChannel> = {},
): GraphQlFullContentAssetChannel => ({
  id: CHANNEL_ID,
  name: "Beaches",
  description: "Sand and sea",
  filterInput: "beach",
  encodedFilter: Buffer.from(
    JSON.stringify({ type: "eq", name: "name", value: "beach" }),
  ).toString("base64"),
  ttl: 7,
  jitter: 300,
  favorite: false,
  bcCompliant: true,
  lastFetchedTime: "2026-09-18T00:00:00Z",
  assetCount: 1,
  assetCache: [
    {
      assetId: ASSET_ID,
      width: 1920,
      height: 1080,
      lastFetchedTime: "2026-09-18T00:00:00Z",
    },
  ],
  category: {
    id: CATEGORY_ID,
    name: "Travel",
    channels_aggregate: { aggregate: { count: 1 } },
    ...times,
  },
  ...times,
  ...overrides,
});

export const graphQlIngestStep = (
  overrides: Partial<GraphQlContentIngestionWorkflowStep> = {},
): GraphQlContentIngestionWorkflowStep => ({
  id: INGEST_STEP_ID,
  type: ContentIngestionWorkflowStepType.TRANSCODE,
  status: ContentIngestionWorkflowStepStatus.RUNNING,
  progress: 10,
  startedTime: "2026-09-18T10:00:00Z",
  finishedTime: "",
  ...times,
  ...overrides,
});

export const graphQlIngestWorkflow = (
  overrides: Partial<GraphQLContentIngestionWorkflow> = {},
): GraphQLContentIngestionWorkflow => ({
  id: INGEST_ID,
  source: "clip.mov",
  sourceType: ContentIngestionWorkflowAssetLocation.LOCAL,
  tempLocation: "/tmp/clip",
  status: ContentIngestionWorkflowStatus.QUEUED,
  startedTime: "",
  finishedTime: "",
  steps: [],
  ...times,
  ...overrides,
});

/** Signing key the content auth tests store under `jwt.key`. */
export const JWT_KEY = "test-jwt-signing-key-0123456789abcdef";
export const OTP_SECRET = "JBSWY3DPEHPK3PXP";

export const contentAuthKeys = {
  "jwt.key": JWT_KEY,
  "bc.key": OTP_SECRET,
} as Record<string, string>;

/** A content auth cookie as VerifyAuthCode issues it. */
export const contentAuthToken = (
  overrides: { issuer?: string; key?: string; expires?: string } = {},
) =>
  new jose.SignJWT({ "urn:example:claim": true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(overrides.issuer ?? "ncfritz.dionysus.content")
    .setAudience("test")
    .setExpirationTime(overrides.expires ?? "15m")
    .sign(new TextEncoder().encode(overrides.key ?? JWT_KEY));
