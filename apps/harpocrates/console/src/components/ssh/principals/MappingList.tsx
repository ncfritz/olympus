import { PlusOutlined, RightOutlined } from "@ant-design/icons";
import {
  Button,
  Flex,
  Input,
  Popconfirm,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { type CSSProperties, useMemo, useState } from "react";
import { timeSince } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/labels";
import { formatLeft, leftOf, shortFingerprint } from "@/lib/sshCertificates";
import {
  type PersonRow,
  PRIVILEGED,
  SPARK_DAYS,
  USAGE_DAYS,
} from "@/lib/sshPrincipals";
import { useTypeColors } from "../cas/SshGraphs";
import styles from "./SshPrincipals.module.css";

/** A Unix user name, as a principal: the service's rule. */
export const PRINCIPAL = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$/;

type Filter = "mapped" | "privileged" | "unmapped";

/** A day's bar: its height and colour, the only values set from code. */
const bar = (share: number, color: string) =>
  ({
    "--height": `${share > 0 ? Math.max(3, Math.round(share * 24)) : 2}px`,
    "--color": share > 0 ? color : "var(--ant-color-fill-secondary)",
  }) as CSSProperties;

/** A principal, as a tag: red when privileged, dashed when unused. */
export function PrincipalTag({
  principal,
  used,
  onRemove,
}: {
  principal: string;
  used: boolean;
  onRemove?: () => void;
}) {
  const privileged = PRIVILEGED.has(principal);
  return (
    <Tooltip
      title={`${privileged ? "Privileged. " : ""}${used ? `Carried by a certificate in the last ${USAGE_DAYS} days` : `No certificate carried it in ${USAGE_DAYS} days`}`}
    >
      <Tag
        color={privileged ? "red" : undefined}
        variant={used ? "filled" : "outlined"}
        className={used ? undefined : styles.unused}
        closable={Boolean(onRemove)}
        onClose={(e) => {
          e.preventDefault();
          onRemove?.();
        }}
      >
        {principal}
      </Tag>
    </Tooltip>
  );
}

/** Adding a principal: a tag that becomes an input. */
function AddPrincipal({
  taken,
  onAdd,
}: {
  taken: string[];
  onAdd: (principal: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const name = value.trim();
  const ok = PRINCIPAL.test(name) && !taken.includes(name);
  const done = () => {
    if (ok) onAdd(name);
    setValue("");
    setAdding(false);
  };
  return adding ? (
    <Input
      size="small"
      autoFocus
      className={styles.newChip}
      placeholder="account"
      status={name && !ok ? "error" : undefined}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onPressEnter={done}
      onBlur={done}
      onClick={(e) => e.stopPropagation()}
      aria-label="A principal to add"
    />
  ) : (
    <Tag
      icon={<PlusOutlined />}
      onClick={(e) => {
        e.stopPropagation();
        setAdding(true);
      }}
    >
      add
    </Tag>
  );
}

/**
 * The People tab: each person mapped, their principals as tags to add or
 * remove in place, their certificates each of the last 30 days, and each
 * opened to their certificates now; then the Olympus people not mapped.
 */
export function MappingList({
  rows,
  unmapped,
  now,
  busy,
  onSet,
  onMap,
}: {
  rows: PersonRow[];
  unmapped: string[];
  now: number;
  busy?: string;
  onSet: (identity: string, principals: string[], done: string) => void;
  onMap: (identity?: string) => void;
}) {
  const colors = useTypeColors();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("mapped");
  const [open, setOpen] = useState<string[]>([]);
  const needle = search.trim().toLowerCase();
  const most = Math.max(1, ...rows.flatMap((r) => r.perDay));
  const privileged = rows.filter((r) =>
    r.principals.some((p) => PRIVILEGED.has(p)),
  );
  const shown = useMemo(
    () =>
      (filter === "privileged"
        ? rows.filter((r) => r.principals.some((p) => PRIVILEGED.has(p)))
        : rows
      ).filter(
        (r) =>
          !needle ||
          r.identity.toLowerCase().includes(needle) ||
          r.principals.some((p) => p.toLowerCase().includes(needle)),
      ),
    [rows, filter, needle],
  );
  const shownUnmapped = unmapped.filter((e) => !needle || e.includes(needle));

  return (
    <>
      <Flex gap="middle" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Search people and principals"
          aria-label="Search people and principals"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "mapped", label: `Mapped ${rows.length}` },
            { value: "privileged", label: `Privileged ${privileged.length}` },
            { value: "unmapped", label: `Not mapped ${unmapped.length}` },
          ]}
        />
        <Flex gap="middle" wrap className={styles.legend}>
          <span className={styles.legendItem}>
            <Tag color="red">root</Tag> privileged
          </span>
          <span className={styles.legendItem}>
            <Tag variant="outlined" className={styles.unused}>
              media
            </Tag>{" "}
            unused {USAGE_DAYS} days
          </span>
        </Flex>
      </Flex>
      {filter !== "unmapped" && (
        <Table<PersonRow>
          rowKey="identity"
          size="middle"
          pagination={false}
          dataSource={shown}
          className={styles.flushTable}
          tableLayout="fixed"
          scroll={{ x: 1000 }}
          locale={{
            emptyText:
              "Nobody is mapped: map a person to issue them a user certificate",
          }}
          expandable={{
            expandedRowKeys: open,
            expandRowByClick: true,
            onExpand: (expanded, r) => setOpen(expanded ? [r.identity] : []),
            expandedRowClassName: () => styles.expandedRow,
            expandIcon: ({ expanded, onExpand, record }) => (
              <button
                type="button"
                className={`${styles.caret} ${expanded ? styles.caretOpen : ""}`}
                aria-label={`${expanded ? "Close" : "Open"} ${record.identity}`}
                aria-expanded={expanded}
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand(record, e);
                }}
              >
                <RightOutlined />
              </button>
            ),
            expandedRowRender: (r) => (
              <Certificates
                row={r}
                now={now}
                busy={busy === r.identity}
                onUnmap={() =>
                  onSet(r.identity, [], `${r.identity} is no longer mapped`)
                }
              />
            ),
          }}
          columns={[
            {
              title: "Person",
              key: "person",
              width: 260,
              render: (_, r) => (
                <Flex vertical className={styles.shrink}>
                  <Typography.Text strong ellipsis={{ tooltip: r.identity }}>
                    {r.identity}
                  </Typography.Text>
                  <Typography.Text type="secondary" className={styles.small}>
                    Mapped {formatDateTime(r.createdAt)}
                  </Typography.Text>
                </Flex>
              ),
            },
            {
              title: "May log in as",
              key: "principals",
              render: (_, r) => (
                <Flex
                  gap={4}
                  wrap
                  align="center"
                  className={styles.chips}
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.principals.map((p) => (
                    <Popconfirm
                      key={p}
                      title={`${r.identity} no longer as ${p}?`}
                      description={
                        r.principals.length === 1
                          ? "Their last principal: they can no longer get a user certificate. Certificates signed already stay valid."
                          : "Certificates signed from now leave it out; those signed already stay valid."
                      }
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                      onConfirm={() =>
                        onSet(
                          r.identity,
                          r.principals.filter((x) => x !== p),
                          `${r.identity} no longer as ${p}`,
                        )
                      }
                    >
                      <span>
                        <PrincipalTag
                          principal={p}
                          used={r.used.has(p)}
                          onRemove={() => {}}
                        />
                      </span>
                    </Popconfirm>
                  ))}
                  <AddPrincipal
                    taken={r.principals}
                    onAdd={(p) =>
                      onSet(
                        r.identity,
                        [...r.principals, p],
                        `${r.identity} may log in as ${p}`,
                      )
                    }
                  />
                </Flex>
              ),
            },
            {
              title: `Signed, ${SPARK_DAYS} days`,
              key: "spark",
              width: 200,
              render: (_, r) => {
                const total = r.perDay.reduce((sum, n) => sum + n, 0);
                return (
                  <Flex gap="small" align="flex-end">
                    <span
                      className={`${styles.spark} ${styles.grow}`}
                      role="img"
                      aria-label={`${total} certificates in ${SPARK_DAYS} days`}
                    >
                      {r.perDay.map((n, i) => (
                        <i key={i} style={bar(n / most, colors.user)} />
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
              title: "Certificates",
              key: "current",
              width: 110,
              render: (_, r) =>
                r.current.length ? (
                  <Tag color="green">{r.current.length} valid</Tag>
                ) : (
                  <Tag>None</Tag>
                ),
            },
            {
              title: "Last signed",
              key: "last",
              width: 120,
              render: (_, r) =>
                r.lastSigned ? (
                  <Tooltip title={formatDateTime(r.lastSigned)}>
                    <Typography.Text className={styles.small}>
                      {timeSince(r.lastSigned, now)}
                    </Typography.Text>
                  </Tooltip>
                ) : (
                  <Typography.Text type="secondary" className={styles.small}>
                    Never
                  </Typography.Text>
                ),
            },
          ]}
        />
      )}
      {(filter === "unmapped" || shownUnmapped.length > 0) && (
        <>
          <div className={styles.section}>Olympus people not mapped</div>
          <Table<{ email: string }>
            rowKey="email"
            size="middle"
            pagination={false}
            showHeader={false}
            dataSource={shownUnmapped.map((email) => ({ email }))}
            className={styles.flushTable}
            locale={{
              emptyText: "Everyone who has signed in to the console is mapped",
            }}
            columns={[
              {
                key: "email",
                render: (_, u) => (
                  <Typography.Text strong>{u.email}</Typography.Text>
                ),
              },
              {
                key: "what",
                render: () => (
                  <Typography.Text type="secondary" className={styles.small}>
                    Not mapped: no user certificate
                  </Typography.Text>
                ),
              },
              {
                key: "map",
                width: 120,
                render: (_, u) => (
                  <Button size="small" onClick={() => onMap(u.email)}>
                    Map…
                  </Button>
                ),
              },
            ]}
          />
          <Typography.Text
            type="secondary"
            className={`${styles.small} ${styles.padded}`}
          >
            Only people who have signed in to this console are known here.
          </Typography.Text>
        </>
      )}
    </>
  );
}

/** A person opened: their certificates now, and unmapping them. */
function Certificates({
  row,
  now,
  busy,
  onUnmap,
}: {
  row: PersonRow;
  now: number;
  busy: boolean;
  onUnmap: () => void;
}) {
  return (
    <div className={styles.indented}>
      <Flex vertical gap="small" className={styles.details}>
        <Typography.Text className={styles.label}>
          Their certificates now
        </Typography.Text>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={row.current}
          locale={{ emptyText: "None valid now" }}
          columns={[
            {
              title: "Key",
              key: "key",
              render: (_, c) => (
                <Typography.Text className={`${styles.mono} ${styles.small}`}>
                  {shortFingerprint(c.fingerprint)}
                </Typography.Text>
              ),
            },
            {
              title: "As",
              key: "as",
              render: (_, c) => (
                <Typography.Text className={`${styles.mono} ${styles.small}`}>
                  {c.principals.join(", ")}
                </Typography.Text>
              ),
            },
            {
              title: "Signed",
              key: "signed",
              render: (_, c) => timeSince(c.createdAt, now),
            },
            {
              title: "Left",
              key: "left",
              render: (_, c) => formatLeft(leftOf(c, now)),
            },
            {
              title: "",
              key: "open",
              render: (_, c) => (
                <Link href={`/ssh/certificates?id=${c.id}`}>Open</Link>
              ),
            },
          ]}
        />
        <Flex gap="small" align="center" wrap>
          <Typography.Text type="secondary" className={styles.small}>
            Changing a mapping changes only certificates signed after; revoke
            these to take access away now.
          </Typography.Text>
          <Popconfirm
            title={`Unmap ${row.identity}?`}
            description="They can no longer get a user certificate. Certificates signed already stay valid until revoked or expired."
            okText="Unmap"
            okButtonProps={{ danger: true }}
            onConfirm={onUnmap}
          >
            <Button size="small" danger loading={busy}>
              Unmap…
            </Button>
          </Popconfirm>
        </Flex>
      </Flex>
    </div>
  );
}
