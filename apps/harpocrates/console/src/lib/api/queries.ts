import useSWR from "swr";
import { apiClient } from "./client";
import { unwrap } from "./errors";
import type {
  AuditEvent,
  Ceremony,
  Certificate,
  CertificateState,
  CurrentUser,
  FullIssuer,
  Issuer,
  PkiRole,
  Profile,
  RevocationList,
  SignerStatus,
} from "./types";

/**
 * The service's answers, as SWR keys: one key per resource, so a change
 * anywhere revalidates every page that shows it (`mutate(KEYS.issuers)`).
 */
export const KEYS = {
  user: "/auth/current-user",
  signer: "/signer/status",
  issuers: "/issuers",
  issuer: (id: string) => `/issuer/${id}`,
  ceremony: (id: string) => `/ceremony/${id}`,
  crls: (issuerId: string) => `/issuer/${issuerId}/crls`,
  profiles: "/profiles",
  certificates: (filter: CertificateFilter) =>
    `/certificates?${new URLSearchParams(
      Object.entries(filter).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)]],
      ),
    ).toString()}`,
  audit: "/audit/events",
} as const;

export type CertificateFilter = {
  issuerId?: string;
  state?: CertificateState;
  search?: string;
  expiringWithinDays?: number;
  startPage?: number;
  pageSize?: number;
};

/** Who is signed in, and what Harpocrates lets them do. */
export const useCurrentUser = () => {
  const answer = useSWR<CurrentUser>(
    KEYS.user,
    async () => unwrap(await apiClient.GET("/v1/auth/current-user")).user,
  );
  const has = (role: PkiRole) => answer.data?.roles.includes(role) ?? false;
  return {
    ...answer,
    isAdmin: has("pki-admin"),
    isOperator: has("pki-admin") || has("pki-operator"),
  };
};

/** The signer's seal, polled: a restart or a timeout changes it unasked. */
export const useSignerStatus = (refreshInterval = 15_000) =>
  useSWR<SignerStatus>(
    KEYS.signer,
    async () => unwrap(await apiClient.GET("/v1/signer/status")).status,
    { refreshInterval },
  );

/** Every CA, parents before children. */
export const useIssuers = () =>
  useSWR<Issuer[]>(
    KEYS.issuers,
    async () => unwrap(await apiClient.GET("/v1/issuers")).issuers,
  );

export const useIssuer = (issuerId: string | undefined) =>
  useSWR<FullIssuer>(
    issuerId ? KEYS.issuer(issuerId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/issuer/{issuerId}", {
          params: { path: { issuerId: issuerId! } },
        }),
      ).issuer,
  );

export const useIssuerCrls = (issuerId: string | undefined) =>
  useSWR<RevocationList[]>(
    issuerId ? KEYS.crls(issuerId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/issuer/{issuerId}/crls", {
          params: { path: { issuerId: issuerId! } },
        }),
      ).crls,
  );

export const useCeremony = (ceremonyId: string | undefined) =>
  useSWR<Ceremony>(
    ceremonyId ? KEYS.ceremony(ceremonyId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/ceremony/{ceremonyId}", {
          params: { path: { ceremonyId: ceremonyId! } },
        }),
      ).ceremony,
  );

export const useProfiles = () =>
  useSWR<Profile[]>(
    KEYS.profiles,
    async () => unwrap(await apiClient.GET("/v1/profiles")).profiles,
  );

export const useCertificates = (filter: CertificateFilter) =>
  useSWR<{ count: number; certificates: Certificate[] }>(
    KEYS.certificates(filter),
    async () =>
      unwrap(
        await apiClient.GET("/v1/certificates", { params: { query: filter } }),
      ),
  );

export const useAuditEvents = (pageSize = 200) =>
  useSWR<AuditEvent[]>(
    KEYS.audit,
    async () =>
      unwrap(
        await apiClient.GET("/v1/audit/events", {
          params: { query: { pageSize } },
        }),
      ).events,
  );
