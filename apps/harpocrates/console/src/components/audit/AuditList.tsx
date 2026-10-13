import {
  Button,
  Descriptions,
  Flex,
  Input,
  Segmented,
  Select,
  Switch,
  Table,
  type TableColumnsType,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { AuditActor, AuditEvent, AuditGroup } from "@/lib/api/types";
import { GROUPS, GROUP_LABELS, SURFACES, subjectHref } from "@/lib/audit";
import { describeEvent, timeSince } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "../ErrorAlert";
import { PrincipalName } from "../PrincipalName";
import styles from "./Audit.module.css";

const PAGE = 50;
const DAY = 24 * 60 * 60 * 1000;

const RANGES = { "24 hours": 1, "7 days": 7, "30 days": 30, All: 0 } as const;
type Range = keyof typeof RANGES;

type Filter = {
  groups: AuditGroup[];
  actor?: AuditActor;
  surface?: string;
  sensitive: boolean;
  since?: string;
  search?: string;
};

/**
 * The audit log itself (the canvas's Audit O): newest first, filtered by
 * text, who, surface, time, sensitivity and the groups (chips, or a lane
 * chosen above), fifty at a time, each event's details and hash beneath
 * it when expanded.
 */
export function AuditList({
  groups,
  onGroups,
  counts,
  now,
}: {
  groups: AuditGroup[];
  onGroups: (groups: AuditGroup[]) => void;
  /** Each group's events in the last 30 days, for its chip. */
  counts: Map<AuditGroup, number>;
  now: number;
}) {
  const [search, setSearch] = useState<string>();
  const [actor, setActor] = useState<AuditActor>();
  const [surface, setSurface] = useState<string>();
  const [sensitive, setSensitive] = useState(false);
  const [range, setRange] = useState<Range>("30 days");
  const filter: Filter = {
    groups,
    actor,
    surface,
    sensitive,
    since: RANGES[range]
      ? new Date(now - RANGES[range] * DAY).toISOString()
      : undefined,
    search,
  };

  const { data, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<AuditEvent[]>(
      (index, previous: AuditEvent[] | null) =>
        previous && previous.length < PAGE
          ? null
          : [
              "/audit/events",
              JSON.stringify(filter),
              previous?.at(-1)?.sequence,
            ],
      async ([, , before]: [string, string, string | undefined]) =>
        unwrap(
          await apiClient.GET("/v1/audit/events", {
            params: {
              query: {
                pageSize: PAGE,
                before,
                groups: filter.groups.length
                  ? filter.groups.join(",")
                  : undefined,
                actor: filter.actor,
                surface: filter.surface,
                sensitive: filter.sensitive ? "true" : undefined,
                since: filter.since,
                search: filter.search,
              },
            },
          }),
        ).events,
    );
  const events = data?.flat() ?? [];
  const more = data !== undefined && (data.at(-1)?.length ?? 0) === PAGE;

  const toggle = (group: AuditGroup) =>
    onGroups(
      groups.includes(group)
        ? groups.filter((g) => g !== group)
        : [...groups, group],
    );

  const columns: TableColumnsType<AuditEvent> = [
    {
      title: "#",
      dataIndex: "sequence",
      width: 80,
      render: (sequence: string) => (
        <Typography.Text type="secondary" className={styles.mono}>
          {sequence}
        </Typography.Text>
      ),
    },
    {
      title: "When",
      dataIndex: "occurredAt",
      width: 110,
      render: (at: string) => (
        <Tooltip title={formatDateTime(at)}>
          <span className={styles.nowrap}>
            {now - Date.parse(at) < 60_000 ? "Just now" : timeSince(at, now)}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Kind",
      dataIndex: "group",
      width: 110,
      render: (group: AuditGroup) => <Tag>{GROUP_LABELS[group]}</Tag>,
    },
    {
      title: "What",
      key: "what",
      render: (_, event) => {
        const href = subjectHref(event);
        // An event about something unnamed (an SSH CA, a profile) by its ID.
        const phrase = describeEvent({
          ...event,
          subjectName: event.subjectName ?? event.subjectId,
        });
        return (
          <Flex vertical className={styles.shrink}>
            <Flex gap={6} align="center" wrap className={styles.tags}>
              {href ? (
                <Link href={href} onClick={(e) => e.stopPropagation()}>
                  {phrase}
                </Link>
              ) : (
                <span>{phrase}</span>
              )}
              {event.sensitive && <Tag color="orange">sensitive</Tag>}
            </Flex>
            {event.reason && (
              <Typography.Text
                type="secondary"
                className={styles.small}
                ellipsis
              >
                “{event.reason}”
              </Typography.Text>
            )}
          </Flex>
        );
      },
    },
    {
      title: "Who",
      dataIndex: "principal",
      width: 190,
      ellipsis: true,
      render: (principal: string) => <PrincipalName principal={principal} />,
    },
    {
      title: "From",
      dataIndex: "surface",
      width: 130,
      render: (surface: string) => (
        <Tag color={SURFACES[surface]?.color}>
          {SURFACES[surface]?.label ?? surface}
        </Tag>
      ),
    },
    {
      title: "Hash",
      dataIndex: "hash",
      width: 100,
      render: (hash: string) => (
        <Tooltip title={hash}>
          <Typography.Text
            type="secondary"
            className={`${styles.mono} ${styles.nowrap}`}
          >
            {hash.slice(0, 8)}…
          </Typography.Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <Flex vertical>
      <Flex gap="small" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Subjects, serials, people, reasons"
          aria-label="Search the audit log"
          className={styles.search}
          onSearch={(value) => setSearch(value.trim() || undefined)}
        />
        <Select<AuditActor>
          allowClear
          placeholder="Anyone"
          aria-label="Who"
          className={styles.filter}
          value={actor}
          onChange={setActor}
          options={[
            { value: "people", label: "People" },
            { value: "system", label: "Harpocrates" },
            { value: "acme", label: "ACME accounts" },
            { value: "holders", label: "Holders, over mTLS" },
          ]}
        />
        <Select<string>
          allowClear
          placeholder="Every surface"
          aria-label="From"
          className={styles.filter}
          value={surface}
          onChange={setSurface}
          options={Object.entries(SURFACES).map(([value, s]) => ({
            value,
            label: s.label,
          }))}
        />
        <Segmented<Range>
          aria-label="Since"
          options={Object.keys(RANGES) as Range[]}
          value={range}
          onChange={setRange}
        />
        <Flex gap="small" align="center">
          <Switch
            size="small"
            checked={sensitive}
            onChange={setSensitive}
            aria-label="Sensitive only"
          />
          <Typography.Text>Sensitive only</Typography.Text>
        </Flex>
      </Flex>
      <Flex gap={6} wrap className={styles.chips}>
        {GROUPS.filter((g) => counts.has(g.key) || groups.includes(g.key)).map(
          (g) => (
            <Tag.CheckableTag
              key={g.key}
              checked={groups.includes(g.key)}
              onChange={() => toggle(g.key)}
              className={styles.chip}
            >
              {g.label}{" "}
              <span className={styles.chipCount}>{counts.get(g.key) ?? 0}</span>
            </Tag.CheckableTag>
          ),
        )}
        {groups.length > 0 && (
          <Button size="small" type="link" onClick={() => onGroups([])}>
            Clear
          </Button>
        )}
      </Flex>
      <ErrorAlert error={error} title="The audit log could not be read" />
      <Table<AuditEvent>
        rowKey="sequence"
        size="middle"
        loading={isLoading}
        dataSource={events}
        columns={columns}
        pagination={false}
        tableLayout="fixed"
        scroll={{ x: 1100 }}
        className={styles.flushTable}
        locale={{ emptyText: "No event matches" }}
        expandable={{
          expandRowByClick: true,
          expandedRowRender: (event) => <Details event={event} />,
        }}
      />
      <Flex justify="space-between" align="center" className={styles.footer}>
        <Typography.Text type="secondary" className={styles.small}>
          Newest first · {events.length.toLocaleString()} shown
        </Typography.Text>
        {more && (
          <Button
            loading={isValidating && size > (data?.length ?? 0)}
            onClick={() => setSize(size + 1)}
          >
            Load older
          </Button>
        )}
      </Flex>
    </Flex>
  );
}

/** One event in full: who exactly, what it concerns, its details, its hash. */
function Details({ event }: { event: AuditEvent }) {
  return (
    <Descriptions column={1} size="small" className={styles.details}>
      <Descriptions.Item label="Sequence">#{event.sequence}</Descriptions.Item>
      <Descriptions.Item label="When">
        {formatDateTime(event.occurredAt)}
      </Descriptions.Item>
      <Descriptions.Item label="Who">
        <Flex gap="small" align="baseline" wrap>
          <PrincipalName principal={event.principal} />
          <Typography.Text type="secondary" className={styles.mono}>
            {event.principal}
          </Typography.Text>
        </Flex>
      </Descriptions.Item>
      <Descriptions.Item label="Kind">
        <Typography.Text className={styles.mono}>{event.kind}</Typography.Text>
      </Descriptions.Item>
      {event.subjectId && (
        <Descriptions.Item label="Concerns">
          {event.subjectType}{" "}
          <Typography.Text className={styles.mono}>
            {event.subjectId}
          </Typography.Text>
        </Descriptions.Item>
      )}
      {event.reason && (
        <Descriptions.Item label="Reason">{event.reason}</Descriptions.Item>
      )}
      {event.attributes.map((attribute) => (
        <Descriptions.Item key={attribute.name} label={attribute.name}>
          {attribute.value}
        </Descriptions.Item>
      ))}
      <Descriptions.Item label="Hash">
        <Typography.Text copyable className={styles.mono}>
          {event.hash}
        </Typography.Text>
      </Descriptions.Item>
    </Descriptions>
  );
}
