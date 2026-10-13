import {
  Button,
  Descriptions,
  Flex,
  Input,
  message,
  Popconfirm,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import {
  type ClientState,
  challengeTypesOf,
  failureOf,
  formatTaken,
  isFailing,
  namesOf,
  nextRenewalOf,
  OUTCOME_DAYS,
  OUTCOMES,
  type Outcome,
  ordersOf,
  outcomeOf,
  outcomesByDay,
  progressOf,
  reasonOf,
  STATES,
  STEPS,
  stateOf,
  timeTakenOf,
  windowStateOf,
} from "@/lib/acme";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS } from "@/lib/api/queries";
import type { AcmeClient, AcmeOrderSummary } from "@/lib/api/types";
import { timeSince, timeUntil } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "../ErrorAlert";
import { PrincipalName } from "../PrincipalName";
import styles from "./Acme.module.css";

/** The list's filters: every client, or those failing, waiting or revoked. */
type Filter = "all" | "failing" | "waiting" | "revoked";

const OUTCOME_CLASS: Record<Outcome, string> = {
  issued: styles.issued,
  failed: styles.failed,
  pending: styles.pending,
};

/** A client's outcome each of its last days: a dot each. */
function Outcomes({ outcomes }: { outcomes: (Outcome | undefined)[] }) {
  const ordered = outcomes.filter(Boolean).length;
  return (
    <span
      className={styles.dots}
      role="img"
      aria-label={`${ordered} of the last ${outcomes.length} days with an order`}
    >
      {outcomes.map((outcome, i) => (
        <i
          key={i}
          className={`${styles.dot} ${outcome ? OUTCOME_CLASS[outcome] : ""}`}
        />
      ))}
    </span>
  );
}

/** An order's progress: a dot for each step, done, failed or not reached. */
export function OrderSteps({ order }: { order: AcmeOrderSummary }) {
  const { done, failedAt } = progressOf(order);
  const said =
    failedAt !== undefined
      ? `Failed at ${STEPS[failedAt].toLowerCase()}`
      : done === STEPS.length
        ? "Certificate issued"
        : `At ${STEPS[done].toLowerCase()}`;
  return (
    <Tooltip title={`${STEPS.join(" → ")}: ${said}`}>
      <span className={styles.steps} role="img" aria-label={said}>
        {STEPS.map((step, i) => (
          <span key={step} className={styles.steps}>
            <i
              className={`${styles.dot} ${
                i === failedAt ? styles.failed : i < done ? styles.issued : ""
              }`}
            />
            {i < STEPS.length - 1 && <i className={styles.link} />}
          </span>
        ))}
      </span>
    </Tooltip>
  );
}

/** An order's outcome: its tag, and why it failed or how long it took. */
export function OrderOutcome({ order }: { order: AcmeOrderSummary }) {
  const outcome = outcomeOf(order);
  const failure = failureOf(order);
  const taken = timeTakenOf(order);
  return (
    <Flex vertical className={styles.shrink}>
      <span>
        <Tag color={OUTCOMES[outcome].color}>{OUTCOMES[outcome].label}</Tag>
      </span>
      {failure ? (
        <Typography.Text
          type="danger"
          className={styles.small}
          ellipsis={{ tooltip: failure.detail }}
        >
          {reasonOf(failure.type)}
          {failure.detail ? `: ${failure.detail}` : ""}
        </Typography.Text>
      ) : taken !== undefined ? (
        <Typography.Text type="secondary" className={styles.small}>
          In {formatTaken(taken)}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

/**
 * The Clients tab: each client a row (what it may request, its
 * credential's state, its last order, its next renewal, its outcome each
 * of the last 15 days), opened to its details, actions and recent orders.
 */
export function ClientList({
  clients,
  orders,
  now,
  isAdmin,
  open,
  onOpen,
}: {
  clients: AcmeClient[];
  orders: AcmeOrderSummary[];
  now: number;
  isAdmin: boolean;
  open?: string;
  onOpen: (credentialId?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(
    () => ({
      all: clients.length,
      failing: clients.filter((c) => isFailing(c, now)).length,
      waiting: clients.filter((c) => stateOf(c) === "waiting").length,
      revoked: clients.filter((c) => stateOf(c) === "revoked").length,
    }),
    [clients, now],
  );
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (filter === "failing" && !isFailing(client, now)) return false;
      if (filter === "waiting" && stateOf(client) !== "waiting") return false;
      if (filter === "revoked" && stateOf(client) !== "revoked") return false;
      if (!needle) return true;
      const { credential } = client;
      return [credential.label, credential.id, ...namesOf(credential)].some(
        (text) => text.toLowerCase().includes(needle),
      );
    });
  }, [clients, filter, search, now]);

  return (
    <>
      <Flex gap="middle" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Search clients, names, key IDs"
          aria-label="Search clients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
        />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={(
            [
              ["all", "All"],
              ["failing", "Failing"],
              ["waiting", "Waiting"],
              ["revoked", "Revoked"],
            ] as const
          ).map(([value, label]) => ({
            value,
            label: `${label} ${counts[value]}`,
          }))}
        />
        <Flex
          gap="middle"
          className={`${styles.legend} ${styles.grow}`}
          justify="flex-end"
        >
          {(["issued", "failed", "pending"] as const).map((outcome) => (
            <span key={outcome} className={styles.legendItem}>
              <i className={`${styles.dot} ${OUTCOME_CLASS[outcome]}`} />
              {OUTCOMES[outcome].label}
            </span>
          ))}
        </Flex>
      </Flex>
      <Table<AcmeClient>
        rowKey={(client) => client.credential.id}
        size="middle"
        pagination={false}
        dataSource={shown}
        className={styles.flushTable}
        tableLayout="fixed"
        scroll={{ x: 960 }}
        locale={{
          emptyText:
            clients.length === 0
              ? "No clients yet: add one, and give it its credential"
              : "No client matches",
        }}
        expandable={{
          expandedRowKeys: open ? [open] : [],
          expandRowByClick: true,
          onExpand: (expanded, client) =>
            onOpen(expanded ? client.credential.id : undefined),
          expandedRowRender: (client) => (
            <ClientDetails
              client={client}
              orders={ordersOf(orders, client.credential.id)}
              now={now}
              isAdmin={isAdmin}
            />
          ),
        }}
        columns={[
          {
            title: "Client",
            key: "client",
            width: 240,
            render: (_, client) => {
              const failure = client.lastOrder && failureOf(client.lastOrder);
              const held = client.certificates.length;
              return (
                <Flex vertical className={styles.shrink}>
                  <Typography.Text strong ellipsis>
                    {client.credential.label}
                  </Typography.Text>
                  <Typography.Text
                    type="secondary"
                    className={styles.small}
                    ellipsis
                  >
                    <span className={styles.mono}>{client.credential.id}</span>{" "}
                    · {held} certificate{held === 1 ? "" : "s"}
                  </Typography.Text>
                  {stateOf(client) === "bound" && failure && (
                    <Typography.Text
                      type="danger"
                      className={styles.small}
                      ellipsis={{ tooltip: failure.detail }}
                    >
                      {reasonOf(failure.type)}
                      {failure.detail ? `: ${failure.detail}` : ""}
                    </Typography.Text>
                  )}
                  {stateOf(client) === "waiting" && (
                    <Typography.Text type="warning" className={styles.small}>
                      Made {timeSince(client.credential.createdAt, now)}; no
                      client has bound it yet
                    </Typography.Text>
                  )}
                </Flex>
              );
            },
          },
          {
            title: "May request",
            key: "names",
            render: (_, client) => (
              <Typography.Text
                className={styles.small}
                ellipsis={{ tooltip: namesOf(client.credential).join(", ") }}
              >
                {namesOf(client.credential).join(", ")}
              </Typography.Text>
            ),
          },
          {
            title: "Credential",
            key: "state",
            width: 130,
            render: (_, client) => <StateTag state={stateOf(client)} />,
          },
          {
            title: "Last order",
            key: "last",
            width: 120,
            render: (_, client) =>
              client.lastOrder ? (
                <Flex vertical align="flex-start">
                  <Typography.Text className={styles.small}>
                    {timeSince(client.lastOrder.createdAt, now)}
                  </Typography.Text>
                  <Tag color={OUTCOMES[outcomeOf(client.lastOrder)].color}>
                    {OUTCOMES[outcomeOf(client.lastOrder)].label}
                  </Tag>
                </Flex>
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              ),
          },
          {
            title: "Next renewal",
            key: "next",
            width: 120,
            render: (_, client) => <NextRenewal client={client} now={now} />,
          },
          {
            title: `Orders, ${OUTCOME_DAYS} days`,
            key: "outcomes",
            width: 190,
            render: (_, client) => (
              <Outcomes
                outcomes={outcomesByDay(
                  ordersOf(orders, client.credential.id),
                  OUTCOME_DAYS,
                  now,
                )}
              />
            ),
          },
        ]}
      />
    </>
  );
}

function StateTag({ state }: { state: ClientState }) {
  return <Tag color={STATES[state].color}>{STATES[state].label}</Tag>;
}

/** When a client should next renew, by its renewal window. */
function NextRenewal({ client, now }: { client: AcmeClient; now: number }) {
  const next = nextRenewalOf(client);
  if (stateOf(client) !== "bound" || !next) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }
  const state = windowStateOf(next, now);
  return (
    <Tooltip
      title={`Its window: ${formatDateTime(next.renewalStart)} to ${formatDateTime(next.renewalEnd)}; it expires ${formatDateTime(next.notAfter)}`}
    >
      {state === "overdue" ? (
        <Typography.Text type="danger" strong>
          Overdue
        </Typography.Text>
      ) : state === "renewing" ? (
        <Typography.Text strong>Now</Typography.Text>
      ) : (
        <Typography.Text>
          In {timeUntil(next.renewalStart, now)}
        </Typography.Text>
      )}
    </Tooltip>
  );
}

/** A client opened: its credential and account, actions, recent orders. */
function ClientDetails({
  client,
  orders,
  now,
  isAdmin,
}: {
  client: AcmeClient;
  orders: AcmeOrderSummary[];
  now: number;
  isAdmin: boolean;
}) {
  const { credential, certificates } = client;
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const recent = (
    orders.length ? orders : client.lastOrder ? [client.lastOrder] : []
  ).slice(0, 5);
  const newest = [...certificates].sort(
    (a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt),
  )[0];

  const revoke = async () => {
    setBusy(true);
    try {
      unwrap(
        await apiClient.POST("/v1/acme/credential/{credentialId}/revoke", {
          params: { path: { credentialId: credential.id } },
        }),
      );
      setError(undefined);
      await mutate(KEYS.acmeClients);
      void messages.success("Revoked");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.expanded}>
      {messageHolder}
      <Flex vertical gap="middle" className={styles.shrink}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Key ID (--eab-kid)">
            <Typography.Text code copyable>
              {credential.id}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Account">
            {credential.account ? (
              <Typography.Text className={styles.small}>
                <span className={styles.mono}>{credential.account.id}</span>,{" "}
                {credential.account.status}; key thumbprint{" "}
                <span className={styles.mono}>
                  {credential.account.keyThumbprint.slice(0, 10)}…
                </span>
              </Typography.Text>
            ) : (
              "None yet"
            )}
          </Descriptions.Item>
          {credential.account?.contacts.length ? (
            <Descriptions.Item label="Contacts">
              {credential.account.contacts.join(", ")}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Made">
            <span>
              {formatDateTime(credential.createdAt)} by{" "}
              <PrincipalName principal={credential.principal} />
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Bound">
            {credential.boundAt
              ? formatDateTime(credential.boundAt)
              : "Not yet"}
          </Descriptions.Item>
          {credential.revokedAt && (
            <Descriptions.Item label="Revoked">
              {formatDateTime(credential.revokedAt)}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Certificates">
            {certificates.length === 0
              ? "None held"
              : certificates
                  .map(
                    (c) =>
                      `${c.names.join(", ")}: expires ${formatDateTime(c.notAfter)}`,
                  )
                  .join("; ")}
          </Descriptions.Item>
        </Descriptions>
        <Flex gap="small" wrap>
          {newest ? (
            <Link
              href={`/certificates?certificateId=${encodeURIComponent(newest.certificateId)}`}
            >
              <Button>Its certificates</Button>
            </Link>
          ) : (
            <Button disabled>Its certificates</Button>
          )}
          {isAdmin && !credential.revokedAt && (
            <Popconfirm
              title="Revoke this client's credential?"
              description={
                credential.account
                  ? "Its account is revoked and can order nothing more. Certificates it was issued stay valid until revoked themselves."
                  : "It can no longer register an account."
              }
              okText="Revoke"
              okButtonProps={{ danger: true }}
              onConfirm={revoke}
            >
              <Button danger loading={busy}>
                Revoke…
              </Button>
            </Popconfirm>
          )}
        </Flex>
        <ErrorAlert error={error} />
      </Flex>
      <Flex vertical gap="small" className={styles.shrink}>
        <Typography.Text className={styles.label}>
          Recent orders
        </Typography.Text>
        <Table<AcmeOrderSummary>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={recent}
          tableLayout="fixed"
          locale={{ emptyText: "No orders yet" }}
          columns={[
            {
              title: "When",
              key: "when",
              width: 96,
              render: (_, order) => (
                <Tooltip title={formatDateTime(order.createdAt)}>
                  <Typography.Text className={styles.small}>
                    {timeSince(order.createdAt, now)}
                  </Typography.Text>
                </Tooltip>
              ),
            },
            {
              title: "Names",
              key: "names",
              render: (_, order) => (
                <Flex vertical className={styles.shrink}>
                  <Typography.Text
                    className={styles.small}
                    ellipsis={{ tooltip: order.identifiers.join(", ") }}
                  >
                    {order.identifiers.join(", ")}
                  </Typography.Text>
                  <Typography.Text type="secondary" className={styles.small}>
                    {challengeTypesOf(order).join(", ") ||
                      "No challenge answered"}
                  </Typography.Text>
                </Flex>
              ),
            },
            {
              title: "Steps",
              key: "steps",
              width: 110,
              render: (_, order) => <OrderSteps order={order} />,
            },
            {
              title: "Result",
              key: "result",
              width: 190,
              render: (_, order) => <OrderOutcome order={order} />,
            },
          ]}
        />
      </Flex>
    </div>
  );
}
