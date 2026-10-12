import useSWR from "swr";
import { apiClient } from "./client";
import { unwrap } from "./errors";
import type {
  AcmeCredential,
  AuditEvent,
  Ceremony,
  CeremonySummary,
  Certificate,
  CertificateState,
  CurrentUser,
  Dashboard,
  DeployTarget,
  FullDeployTarget,
  FullIssuer,
  IssuedCount,
  Issuer,
  IssuerOcsp,
  PkiRole,
  Profile,
  ProfileVersion,
  RevocationList,
  SignerStatus,
  MySsh,
  SshCa,
  SshCertificate,
  SshCertificateType,
  SshPrincipalMapping,
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
  issued: (issuerId: string) => `/issuer/${issuerId}/issued`,
  issuerCeremonies: (issuerId: string) => `/issuer/${issuerId}/ceremonies`,
  issuerOcsp: (issuerId: string) => `/issuer/${issuerId}/ocsp-responders`,
  profiles: "/profiles",
  profileVersions: (id: string) => `/profile/${id}/versions`,
  certificates: (filter: CertificateFilter) =>
    `/certificates?${new URLSearchParams(
      Object.entries(filter).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)]],
      ),
    ).toString()}`,
  audit: "/audit/events",
  dashboard: "/dashboard",
  deployTargets: "/deploy-targets",
  deployTarget: (id: string) => `/deploy-target/${id}`,
  acmeCredentials: "/acme/credentials",
  sshCas: "/ssh/cas",
  sshCertificates: (filter: SshCertificateFilter) =>
    `/ssh/certificates?${new URLSearchParams(
      Object.entries(filter).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)]],
      ),
    ).toString()}`,
  sshCertificate: (id: string) => `/ssh/certificate/${id}`,
  sshPrincipals: "/ssh/principals",
  mySsh: "/ssh/mine",
} as const;

export type SshCertificateFilter = {
  type?: SshCertificateType;
  current?: "true" | "false";
};

/** Whether an SWR key is one of the SSH certificates' answers. */
export const isSshCertificateKey = (key: unknown): boolean =>
  typeof key === "string" &&
  (key.startsWith("/ssh/certificate") || key === "/ssh/mine");

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

/** The CA at a glance, polled: renewals and checks run unasked. */
export const useDashboard = (refreshInterval = 60_000) =>
  useSWR<Dashboard>(
    KEYS.dashboard,
    async () => unwrap(await apiClient.GET("/v1/dashboard")).dashboard,
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

/** What is beneath a CA, by tier and type. */
export const useIssued = (issuerId: string | undefined) =>
  useSWR<IssuedCount[]>(
    issuerId ? KEYS.issued(issuerId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/issuer/{issuerId}/issued", {
          params: { path: { issuerId: issuerId! } },
        }),
      ).counts,
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

/**
 * A CA's OCSP responders, newest first, and how fresh its responses are
 * (ADR 0036). Polled: the scheduler signs and renews unasked.
 */
export const useIssuerOcsp = (
  issuerId: string | undefined,
  refreshInterval = 60_000,
) =>
  useSWR<IssuerOcsp>(
    issuerId ? KEYS.issuerOcsp(issuerId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/issuer/{issuerId}/ocsp-responders", {
          params: { path: { issuerId: issuerId! } },
        }),
      ),
    { refreshInterval },
  );

/** An offline CA's ceremonies, newest first (admins only). */
export const useIssuerCeremonies = (issuerId: string | undefined) =>
  useSWR<CeremonySummary[]>(
    issuerId ? KEYS.issuerCeremonies(issuerId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/issuer/{issuerId}/ceremonies", {
          params: { path: { issuerId: issuerId! } },
        }),
      ).ceremonies,
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

/** A profile's versions, newest first. */
export const useProfileVersions = (profileId: string | undefined) =>
  useSWR<ProfileVersion[]>(
    profileId ? KEYS.profileVersions(profileId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/profile/{profileId}/versions", {
          params: { path: { profileId: profileId! } },
        }),
      ).versions,
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

/** Every deploy target, by name, polled: the service deploys unasked. */
export const useDeployTargets = (refreshInterval = 30_000) =>
  useSWR<DeployTarget[]>(
    KEYS.deployTargets,
    async () => unwrap(await apiClient.GET("/v1/deploy-targets")).deployTargets,
    { refreshInterval },
  );

export const useDeployTarget = (
  targetId: string | undefined,
  refreshInterval = 30_000,
) =>
  useSWR<FullDeployTarget>(
    targetId ? KEYS.deployTarget(targetId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/deploy-target/{targetId}", {
          params: { path: { targetId: targetId! } },
        }),
      ).deployTarget,
    { refreshInterval },
  );

/** Every ACME credential, newest first, with its account. */
export const useAcmeCredentials = () =>
  useSWR<AcmeCredential[]>(
    KEYS.acmeCredentials,
    async () => unwrap(await apiClient.GET("/v1/acme/credentials")).credentials,
  );

/** The SSH CAs, users' first, newest generation first. */
export const useSshCas = () =>
  useSWR<SshCa[]>(
    KEYS.sshCas,
    async () => unwrap(await apiClient.GET("/v1/ssh/cas")).cas,
  );

/** SSH certificates, newest first (the latest 500). */
export const useSshCertificates = (filter: SshCertificateFilter) =>
  useSWR<SshCertificate[]>(
    KEYS.sshCertificates(filter),
    async () =>
      unwrap(
        await apiClient.GET("/v1/ssh/certificates", {
          params: { query: filter },
        }),
      ).certificates,
  );

export const useSshCertificate = (certificateId: string | undefined) =>
  useSWR<SshCertificate>(
    certificateId ? KEYS.sshCertificate(certificateId) : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/ssh/certificate/{certificateId}", {
          params: { path: { certificateId: certificateId! } },
        }),
      ).certificate,
  );

/** Who may log in as whom (admins only). */
export const useSshPrincipals = (enabled = true) =>
  useSWR<SshPrincipalMapping[]>(
    enabled ? KEYS.sshPrincipals : null,
    async () => unwrap(await apiClient.GET("/v1/ssh/principals")).mappings,
  );

/** One's own principals and user certificates: anyone signed in. */
export const useMySsh = () =>
  useSWR<MySsh>(KEYS.mySsh, async () =>
    unwrap(await apiClient.GET("/v1/ssh/mine")),
  );
