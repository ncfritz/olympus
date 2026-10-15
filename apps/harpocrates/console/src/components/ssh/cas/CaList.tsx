import { ExpandCaret } from "@ncfritz/olympus-console";
import { Flex, Table, Tag, Typography } from "antd";
import type { CSSProperties } from "react";
import type {
  SshActivityCertificate,
  SshCa,
  SshCaActivity,
} from "@/lib/api/types";
import { describeHours } from "@/lib/ssh";
import {
  ACTIVITY_DAYS,
  caIssuedByDay,
  familiesOf,
  isSuperseded,
  keyTypeOf,
} from "@/lib/sshCas";
import { CaDetails } from "./CaDetails";
import styles from "./SshCas.module.css";
import { useTypeColors } from "./SshGraphs";

/** A CA's type, as a tag. */
export const TypeTag = ({ ca }: { ca: Pick<SshCa, "type"> }) =>
  ca.type === "user" ? (
    <Tag color="blue">User</Tag>
  ) : (
    <Tag color="purple">Host</Tag>
  );

/** A CA's state: active, active beside a newer generation, or retired. */
export const StatusTag = ({ ca, cas }: { ca: SshCa; cas: SshCa[] }) =>
  ca.status === "retired" ? (
    <Tag>Retired</Tag>
  ) : isSuperseded(ca, cas) ? (
    <Tag color="gold">Active, superseded</Tag>
  ) : (
    <Tag color="green">Active</Tag>
  );

/** A bar's height and colour: the only values set from code. */
const bar = (share: number, color: string) =>
  ({
    "--height": `${Math.max(1, Math.round(share * 22))}px`,
    "--color": color,
  }) as CSSProperties;

/**
 * The Authorities tab's list: every CA, generation by generation, with
 * its certificates valid now and issued each of the last 30 days, each
 * opened to how it is trusted, its trust line and KRL, and its rotation.
 */
export function CaList({
  cas,
  activity,
  certificates,
  now,
  isAdmin,
  busy,
  onRotate,
  onRetire,
}: {
  cas: SshCa[];
  activity: Map<string, SshCaActivity>;
  certificates: SshActivityCertificate[];
  now: number;
  isAdmin: boolean;
  busy?: string;
  onRotate: (ca: SshCa) => void;
  onRetire: (ca: SshCa) => void;
}) {
  const families = familiesOf(cas);
  const colors = useTypeColors();
  const series = new Map(
    cas.map((ca) => [
      ca.id,
      caIssuedByDay(certificates, ca.id, ACTIVITY_DAYS, now),
    ]),
  );
  const most = Math.max(1, ...[...series.values()].flat());
  return (
    <Table<SshCa>
      rowKey="id"
      size="middle"
      pagination={false}
      dataSource={cas}
      className={styles.flushTable}
      tableLayout="fixed"
      scroll={cas.length ? { x: 900 } : undefined}
      locale={{ emptyText: "No SSH CA yet: make the user CA first" }}
      expandable={{
        expandRowByClick: true,
        expandIcon: ({ expanded, onExpand, record }) => (
          <ExpandCaret
            expanded={expanded}
            label={record.name}
            onToggle={(event) => onExpand(record, event)}
          />
        ),
        expandedRowClassName: () => styles.expandedRow,
        expandedRowRender: (ca) => (
          <CaDetails
            ca={ca}
            family={families.find(
              (f) => f.type === ca.type && f.number === ca.number,
            )!}
            activity={activity}
            now={now}
            isAdmin={isAdmin}
            busy={busy}
            onRotate={onRotate}
            onRetire={onRetire}
          />
        ),
      }}
      columns={[
        {
          title: "CA",
          key: "ca",
          render: (_, ca) => (
            <Flex vertical className={styles.shrink}>
              <Typography.Text strong ellipsis>
                {ca.name}
              </Typography.Text>
              <Flex gap="small" align="center" className={styles.small}>
                <Typography.Text type="secondary" className={styles.small}>
                  {keyTypeOf(ca)} · <span className={styles.mono}>{ca.id}</span>
                </Typography.Text>
                <span
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <Typography.Text
                    className={styles.small}
                    copyable={{
                      text: ca.trustLine,
                      tooltips: ["Copy its trust line", "Copied"],
                    }}
                  >
                    trust line
                  </Typography.Text>
                </span>
              </Flex>
            </Flex>
          ),
        },
        {
          title: "Type",
          key: "type",
          width: 90,
          render: (_, ca) => <TypeTag ca={ca} />,
        },
        {
          title: "Longest",
          key: "longest",
          width: 110,
          render: (_, ca) => describeHours(ca.maxValidityHours),
        },
        {
          title: "Valid",
          key: "valid",
          width: 80,
          render: (_, ca) => activity.get(ca.id)?.valid ?? 0,
        },
        {
          title: `Issued, ${ACTIVITY_DAYS} days`,
          key: "issued",
          width: 190,
          render: (_, ca) => {
            const counts = series.get(ca.id) ?? [];
            const total = activity.get(ca.id)?.issued ?? 0;
            return (
              <Flex gap="small" align="flex-end">
                <span
                  className={styles.spark}
                  role="img"
                  aria-label={`${total} issued in ${ACTIVITY_DAYS} days`}
                >
                  {counts.map((n, i) => (
                    <i
                      key={i}
                      style={bar(
                        n / most,
                        n ? colors[ca.type] : "var(--ant-color-fill-secondary)",
                      )}
                    />
                  ))}
                </span>
                <Typography.Text type="secondary" className={styles.small}>
                  {total}
                </Typography.Text>
              </Flex>
            );
          },
        },
        {
          title: "Status",
          key: "status",
          width: 150,
          render: (_, ca) => <StatusTag ca={ca} cas={cas} />,
        },
      ]}
    />
  );
}
