import { SafetyCertificateOutlined } from "@ant-design/icons";
import { useThemeMode } from "@ncfritz/olympus-console";
import { Flex, Tag, Tooltip } from "antd";
import type { CSSProperties } from "react";
import type { DashboardAuthority, Issuer, IssuerTier } from "@/lib/api/types";
import { SHAPES, STATUS_COLORS } from "@/lib/labels";
import { backupUnproved, windowOf } from "@/lib/roots";
import { CATEGORICAL } from "../dashboard/chartColors";
import styles from "./Roots.module.css";

/**
 * The tiers' colours: the data-viz palette's first three categorical
 * slots, issuing CAs (the most) first; a CA outside the roots is neutral.
 * Each is named beside it wherever it is drawn.
 */
export const useTierColors = () => {
  const { resolvedMode } = useThemeMode();
  const [issuing, root, intermediate] = CATEGORICAL[resolvedMode];
  return {
    root,
    intermediate,
    issuing,
    outside: "#8c8c8c",
  } as Record<IssuerTier | "outside", string>;
};

/** A colour as the one value set from code: the CSS reads it as --tier. */
export const tierStyle = (color: string) =>
  ({ "--tier": color }) as CSSProperties;

/** A CA's mark: its tier's colour, outside the roots grey. */
export function CaIcon({
  issuer,
  outside = false,
}: {
  issuer: Pick<Issuer, "tier">;
  outside?: boolean;
}) {
  const colors = useTierColors();
  return (
    <span
      className={styles.icon}
      style={tierStyle(outside ? colors.outside : colors[issuer.tier])}
      aria-hidden
    >
      <SafetyCertificateOutlined />
    </span>
  );
}

/** What a CA's row says beside its name: its shape, and any warning. */
export function NameTags({ issuer }: { issuer: Issuer }) {
  return (
    <>
      {issuer.shape && <Tag>{SHAPES[issuer.shape].label}</Tag>}
      {backupUnproved(issuer) && <Tag color="red">Backup not proved</Tag>}
      {issuer.status !== "active" && (
        <Tag color={STATUS_COLORS[issuer.status]}>{issuer.status}</Tag>
      )}
    </>
  );
}

/** A CA's state in tags: how long it issues, its key, its status. */
export function StateTags({ issuer, now }: { issuer: Issuer; now: number }) {
  const window = windowOf(issuer, now);
  return (
    <Flex gap={4} wrap className={styles.tags}>
      <Tag color={window.color}>{window.label}</Tag>
      <Tooltip
        title={
          issuer.offline
            ? "Its key comes out only in ceremonies"
            : "It signs from the online signer"
        }
      >
        <Tag>{issuer.offline ? "offline" : "online"}</Tag>
      </Tooltip>
      <Tag color={STATUS_COLORS[issuer.status]}>{issuer.status}</Tag>
    </Flex>
  );
}

/** A CA's certificates, as the page counts them. */
export const certificatesOf = (authority: DashboardAuthority | undefined) => ({
  valid: authority?.valid ?? 0,
  expired: authority?.expired ?? 0,
  revoked: authority?.revoked ?? 0,
});
