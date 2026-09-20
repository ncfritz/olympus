import Image from "next/image";

export type Provider = "google" | "microsoft";

interface ProviderMeta {
  label: string;
  /** Small square brand icon (public/*.webp) — sources list, provider columns. */
  icon: string;
  iconWidth: number;
  iconHeight: number;
  /** Full wordmark logo (public/*_logo.webp) — the add-account modal. */
  logo: string;
  logoWidth: number;
  logoHeight: number;
}

/** Brand assets + display name for each connected provider — extend as new connectors ship. Shared across EventsPanel, CalendarAccountsPanel, SyncHistoryPage, and PublishPage so every provider mention renders identically. */
export const PROVIDER_META: Record<Provider, ProviderMeta> = {
  google: {
    label: "Google",
    icon: "/google.webp",
    iconWidth: 64,
    iconHeight: 64,
    logo: "/google_logo.webp",
    logoWidth: 278,
    logoHeight: 94,
  },
  microsoft: {
    label: "Microsoft 365",
    icon: "/o365.webp",
    iconWidth: 64,
    iconHeight: 65,
    logo: "/o365_logo.webp",
    logoWidth: 482,
    logoHeight: 94,
  },
};

/** The small square brand icon at a given pixel size, aspect-correct. */
export function ProviderIcon({
  provider,
  size = 16,
}: {
  provider: Provider;
  size?: number;
}) {
  const meta = PROVIDER_META[provider];
  return (
    <Image
      src={meta.icon}
      alt={meta.label}
      width={size}
      height={size}
      style={{ flexShrink: 0, objectFit: "contain" }}
    />
  );
}

/** The full wordmark logo, scaled to a given pixel height with its aspect ratio preserved. */
export function ProviderLogo({
  provider,
  height = 80,
}: {
  provider: Provider;
  height?: number;
}) {
  const meta = PROVIDER_META[provider];
  const width = Math.round((meta.logoWidth / meta.logoHeight) * height);
  return (
    <Image
      src={meta.logo}
      alt={meta.label}
      width={width}
      height={height}
      style={{ objectFit: "contain" }}
    />
  );
}
