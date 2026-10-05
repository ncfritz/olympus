import Image, { type StaticImageData } from "next/image";
import googleIcon from "../../public/google.webp";
import googleLogo from "../../public/google_logo.webp";
import o365Icon from "../../public/o365.webp";
import o365Logo from "../../public/o365_logo.webp";

export type Provider = "google" | "microsoft";

interface ProviderMeta {
  label: string;
  /**
   * Small square brand icon (public/*.webp) — sources list, provider columns.
   * Imported, not named by path: next/image doesn't put the console's
   * basePath in front of a path, so "/google.webp" was asked for at the
   * control host's root and not found.
   */
  icon: StaticImageData;
  iconWidth: number;
  iconHeight: number;
  /** Full wordmark logo (public/*_logo.webp) — the add-account modal. */
  logo: StaticImageData;
  logoWidth: number;
  logoHeight: number;
}

/** Brand assets + display name for each connected provider — extend as new connectors ship. Shared across EventsPanel, CalendarAccountsPanel, SyncHistoryPage, and PublishPage so every provider mention renders identically. */
export const PROVIDER_META: Record<Provider, ProviderMeta> = {
  google: {
    label: "Google",
    icon: googleIcon,
    iconWidth: 64,
    iconHeight: 64,
    logo: googleLogo,
    logoWidth: 278,
    logoHeight: 94,
  },
  microsoft: {
    label: "Microsoft 365",
    icon: o365Icon,
    iconWidth: 64,
    iconHeight: 65,
    logo: o365Logo,
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
