import { RightOutlined } from "@ant-design/icons";
import {
  Button,
  Flex,
  Input,
  message,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { type CSSProperties, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { isSshCertificateKey } from "@/lib/api/queries";
import type { SshCertificate } from "@/lib/api/types";
import { timeSince } from "@/lib/dashboard";
import { formatDateTime, REVOCATION_REASONS } from "@/lib/labels";
import {
  formatLeft,
  holderOf,
  isCurrent,
  isLive,
  leftOf,
  lifeOf,
  renewedIds,
  SHOWN_STATES,
  shortFingerprint,
  shownStateOf,
} from "@/lib/sshCertificates";
import { useTypeColors } from "../cas/SshGraphs";
import { SshCertificateFile } from "../SshCertificateFile";
import { SshCertificateView } from "../SshCertificateView";
import { SshRevokeForm } from "../SshRevokeForm";
import styles from "./SshCertificates.module.css";

/** The list's filters. */
export type Filter = "valid" | "user" | "host" | "revoked" | "all";

const FILTERS: [Filter, string][] = [
  ["valid", "Valid"],
  ["user", "Users"],
  ["host", "Hosts"],
  ["revoked", "Revoked"],
  ["all", "Everything"],
];

const matches = (
  c: SshCertificate,
  filter: Filter,
  now: number,
  renewed: Set<string>,
): boolean =>
  filter === "all"
    ? true
    : filter === "revoked"
      ? c.state === "revoked"
      : isLive(c, now, renewed) && (filter === "valid" || c.type === filter);

/** A bar's length and colour: the only values set from code. */
const fill = (share: number, color: string) =>
  ({
    "--width": `${Math.max(0, Math.min(1, share)) * 100}%`,
    "--color": color,
  }) as CSSProperties;

/** A certificate's type, as a tag. */
export const TypeTag = ({ type }: { type: SshCertificate["type"] }) =>
  type === "user" ? (
    <Tag color="blue">User</Tag>
  ) : (
    <Tag color="purple">Host</Tag>
  );

/**
 * The List tab: every certificate (the newest 500), filtered, with its
 * time left as a bar; each opened, indented under its holder, to what it
 * says, its file, the line sshd logs for it, and revoking it.
 */
export function CertificateList({
  certificates,
  now,
  canRevoke,
  filter,
  onFilter,
  open,
  onOpen,
}: {
  certificates: SshCertificate[];
  now: number;
  canRevoke: boolean;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  open?: string;
  onOpen: (id?: string) => void;
}) {
  const colors = useTypeColors();
  const [search, setSearch] = useState("");
  const renewed = useMemo(() => renewedIds(certificates), [certificates]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(([f]) => [
          f,
          certificates.filter((c) => matches(c, f, now, renewed)).length,
        ]),
      ) as Record<Filter, number>,
    [certificates, now, renewed],
  );
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return certificates.filter(
      (c) =>
        matches(c, filter, now, renewed) &&
        (!needle ||
          [
            holderOf(c),
            c.keyIdentifier,
            c.serial,
            c.fingerprint,
            c.caId,
            ...c.principals,
          ].some((text) => text.toLowerCase().includes(needle))),
    );
  }, [certificates, filter, search, now, renewed]);

  return (
    <>
      <Flex gap="middle" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Search people, hosts, principals, key IDs, serials"
          aria-label="Search certificates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
        <Segmented<Filter>
          value={filter}
          onChange={onFilter}
          options={FILTERS.map(([value, label]) => ({
            value,
            label: `${label} ${counts[value]}`,
          }))}
        />
      </Flex>
      <Table<SshCertificate>
        rowKey="id"
        size="middle"
        dataSource={shown}
        className={styles.flushTable}
        tableLayout="fixed"
        scroll={{ x: 1000 }}
        pagination={
          shown.length > 50 ? { pageSize: 50, showSizeChanger: false } : false
        }
        locale={{
          emptyText:
            filter === "valid"
              ? "No SSH certificate is valid now"
              : "No certificate matches",
        }}
        expandable={{
          expandedRowKeys: open ? [open] : [],
          expandRowByClick: true,
          onExpand: (expanded, c) => onOpen(expanded ? c.id : undefined),
          expandedRowClassName: () => styles.expandedRow,
          expandIcon: ({ expanded, onExpand, record }) => (
            <button
              type="button"
              className={`${styles.caret} ${expanded ? styles.caretOpen : ""}`}
              aria-label={`${expanded ? "Close" : "Open"} ${holderOf(record)}`}
              aria-expanded={expanded}
              onClick={(e) => {
                e.stopPropagation();
                onExpand(record, e);
              }}
            >
              <RightOutlined />
            </button>
          ),
          expandedRowRender: (c) => (
            <Details
              certificate={c}
              certificates={certificates}
              canRevoke={canRevoke}
              onOpen={onOpen}
            />
          ),
        }}
        columns={[
          {
            title: "For",
            key: "for",
            render: (_, c) => (
              <Flex vertical className={styles.shrink}>
                <Typography.Text strong ellipsis={{ tooltip: holderOf(c) }}>
                  {holderOf(c)}
                </Typography.Text>
                <Typography.Text
                  type="secondary"
                  className={styles.small}
                  ellipsis
                >
                  {c.type === "user"
                    ? `key ${shortFingerprint(c.fingerprint)}`
                    : c.renewsId
                      ? "renewed itself"
                      : "issued by hand"}{" "}
                  · <span className={styles.mono}>{c.caId}</span>
                </Typography.Text>
              </Flex>
            ),
          },
          {
            title: "Type",
            key: "type",
            width: 80,
            render: (_, c) => <TypeTag type={c.type} />,
          },
          {
            title: "Log in as / names",
            key: "principals",
            render: (_, c) => (
              <Typography.Text
                className={`${styles.small} ${styles.mono}`}
                ellipsis={{ tooltip: c.principals.join(", ") }}
              >
                {c.principals.join(", ")}
              </Typography.Text>
            ),
          },
          {
            title: "Time left",
            key: "left",
            width: 200,
            render: (_, c) => {
              const current = isCurrent(c, now);
              const share = current ? leftOf(c, now) / lifeOf(c) : 0;
              return (
                <Tooltip
                  title={`Valid ${formatDateTime(c.validAfter)} to ${formatDateTime(c.validBefore)}`}
                >
                  <div className={styles.timeLeft}>
                    <div className={styles.track} aria-hidden>
                      <span
                        className={`${styles.fill} ${share < 0.15 ? styles.low : ""}`}
                        style={fill(share, colors[c.type])}
                      />
                    </div>
                    <Typography.Text type="secondary" className={styles.small}>
                      {current ? formatLeft(leftOf(c, now)) : "—"}
                    </Typography.Text>
                  </div>
                </Tooltip>
              );
            },
          },
          {
            title: "Issued",
            key: "issued",
            width: 120,
            render: (_, c) => (
              <Tooltip title={formatDateTime(c.createdAt)}>
                <Typography.Text className={styles.small}>
                  {timeSince(c.createdAt, now)}
                </Typography.Text>
              </Tooltip>
            ),
          },
          {
            title: "State",
            key: "state",
            width: 110,
            render: (_, c) => {
              const state = SHOWN_STATES[shownStateOf(c, now, renewed)];
              return <Tag color={state.color}>{state.label}</Tag>;
            },
          },
        ]}
      />
    </>
  );
}

/** A certificate opened: what it says, its file, how it is used, revoking. */
function Details({
  certificate: c,
  certificates,
  canRevoke,
  onOpen,
}: {
  certificate: SshCertificate;
  certificates: SshCertificate[];
  canRevoke: boolean;
  onOpen: (id?: string) => void;
}) {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const [revoking, setRevoking] = useState(false);
  const renews = c.renewsId
    ? certificates.find((other) => other.id === c.renewsId)
    : undefined;
  return (
    <div className={styles.indented}>
      {messageHolder}
      <div className={styles.expandedGrid}>
        <Flex vertical gap="middle" className={styles.shrink}>
          <SshCertificateView contents={c.contents} />
          <Typography.Text type="secondary" className={styles.small}>
            Signed by{" "}
            <Link href="/ssh/cas" className={styles.mono}>
              {c.caId}
            </Link>{" "}
            under {c.profileId} v{c.profileVersion},{" "}
            {formatDateTime(c.createdAt)}
            {renews && (
              <>
                ; it renews{" "}
                <Typography.Link onClick={() => onOpen(renews.id)}>
                  the one before
                </Typography.Link>
              </>
            )}
            {c.revokedAt &&
              `. Revoked ${formatDateTime(c.revokedAt)}${c.revocationReason ? `: ${REVOCATION_REASONS[c.revocationReason].toLowerCase()}` : ""}`}
          </Typography.Text>
          {canRevoke && c.state === "valid" && !revoking && (
            <span>
              <Button danger onClick={() => setRevoking(true)}>
                Revoke…
              </Button>
            </span>
          )}
          {revoking && (
            <SshRevokeForm
              certificate={c}
              onRevoked={async () => {
                await mutate(isSshCertificateKey);
                setRevoking(false);
                void messages.success("Revoked: its CA's KRL lists it now");
              }}
            />
          )}
        </Flex>
        <Flex vertical gap="small" className={styles.shrink}>
          <Typography.Text className={styles.label}>Its file</Typography.Text>
          <SshCertificateFile
            certificate={c.certificate}
            contents={c.contents}
          />
          <Typography.Text className={styles.label}>
            {c.type === "user"
              ? "As sshd logs a login with it"
              : "How the host keeps it"}
          </Typography.Text>
          {c.type === "user" ? (
            <code className={styles.code}>
              Accepted publickey for {c.principals[0] ?? "…"} from … ssh2:{" "}
              {c.contents.keyType.replace(/^ssh-/, "").toUpperCase()}-CERT{" "}
              {c.fingerprint} ID {c.keyIdentifier} (serial {c.contents.serial})
            </code>
          ) : (
            <Typography.Text type="secondary" className={styles.small}>
              {c.renewsId
                ? "It renewed itself (harpocrates-ssh-host), signing a challenge with its host key; it will again once two thirds of its life have passed."
                : "Issued by hand. Install the harpocrates-ssh-host timer on it and it renews itself from here on."}
            </Typography.Text>
          )}
        </Flex>
      </div>
    </div>
  );
}
