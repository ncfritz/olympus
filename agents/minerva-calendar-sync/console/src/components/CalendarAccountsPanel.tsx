"use client";

import {
  CheckOutlined,
  GoogleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  SyncOutlined,
  WindowsOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ColorPicker,
  Flex,
  message,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import {
  addCalendar,
  fetchAvailableCalendars,
  fetchCalendarAccountStatuses,
  fetchCalendars,
  fetchNewAccountAuthStatus,
  removeCalendar,
  setCalendarEnabled,
  setCalendarIncludedInBusy,
  startCalendarAccountReauth,
  startNewAccountAuth,
  triggerCalendarSync,
  type CalendarAccountStatus,
  type CalendarStatus,
} from "@/lib/api/queries";
import { useCalendarColors } from "@/lib/useCalendarColors";

const STATUS_TAG: Record<
  CalendarAccountStatus["status"],
  { color: string; label: string }
> = {
  ok: { color: "green", label: "Connected" },
  expired: { color: "red", label: "Expired" },
  reauth_pending: { color: "blue", label: "Waiting for sign-in…" },
  not_connected: { color: "default", label: "Not connected" },
  error: { color: "red", label: "Error" },
};

const NEEDS_REAUTH: CalendarAccountStatus["status"][] = [
  "expired",
  "error",
  "not_connected",
];

/** How often to re-poll while a login flow is in flight — otherwise SWR only refetches on manual refresh/mount. */
const POLL_WHILE_PENDING_MS = 3000;

/** How often to re-poll while any calendar is syncing, so the "syncing" indicator (and the buttons it disables) clears on its own once a background poll/push-triggered sync finishes, not just a manually-triggered one. */
const POLL_WHILE_SYNCING_MS = 3000;

/** How often to poll a new-account authorization while it's waiting on the user to finish signing in. */
const POLL_NEW_ACCOUNT_AUTH_MS = 2000;

/** Icon + display name for each connected provider — extend as new connectors ship. */
const PROVIDER_META: Record<CalendarAccountStatus["provider"], { label: string; icon: ReactNode }> = {
  google: { label: "Google", icon: <GoogleOutlined /> },
  microsoft: { label: "Microsoft 365", icon: <WindowsOutlined /> },
};

/**
 * accountLabel alone isn't a unique account identity — the same label
 * (typically an email address) can be connected under more than one
 * provider at once — so every account-scoped lookup/row-key below is keyed
 * by provider + accountLabel together.
 */
function accountKey(provider: CalendarAccountStatus["provider"], accountLabel: string): string {
  return `${provider}:${accountLabel}`;
}

/** Fixed so "Enable" and "Disable" render at the same width and the row doesn't jiggle when a calendar's state flips. */
const ENABLE_TOGGLE_BUTTON_WIDTH = 96;

/** Diameter of the color swatch (and its reserved space when a row has none) in the Source column. */
const SOURCE_SWATCH_SIZE = 16;

/** Fixed so "Enabled" / "Disabled" / "Not synchronized" tags all render at the same width. */
const STATUS_TAG_WIDTH = 132;

/** Fixed width for the Status / Last synced columns. */
const INFO_COLUMN_WIDTH = 170;

/** A fixed width for the Source column, so it doesn't compete with Calendar ID for leftover table width. */
const SOURCE_COLUMN_WIDTH = 240;

/** Fixed so every row's Remove/Sync now/Enable buttons sit at the same horizontal position, whether or not a given row shows all three. */
const REMOVE_BUTTON_WIDTH = 92;
const SYNC_BUTTON_WIDTH = 112;

/** Remove + Sync now + Enable/Disable, each fixed-width, plus two 8px gaps. */
const ACTIONS_COLUMN_WIDTH = REMOVE_BUTTON_WIDTH + SYNC_BUTTON_WIDTH + ENABLE_TOGGLE_BUTTON_WIDTH + 16;

/** Fixed width for the "Included in busy" switch column — fits its header text plus the switch. */
const BUSY_INCLUSION_COLUMN_WIDTH = 140;

/** A row in an account's calendar table — either one already being synced, or one Google reports that hasn't been added yet. */
type CalendarRow =
  | (CalendarStatus & { tracked: true })
  | { tracked: false; calendarId: string; source: string };

function detailFor(account: CalendarAccountStatus): string | undefined {
  switch (account.status) {
    case "ok":
      return account.accessTokenExpiresAt
        ? `Refreshes automatically — access token valid until ${new Date(account.accessTokenExpiresAt).toLocaleString()}`
        : undefined;
    case "expired":
    case "error":
      return account.error;
    case "not_connected":
      return "No login has been completed for this account yet";
    case "reauth_pending":
      return "Complete sign-in in the tab that just opened";
  }
}

export function CalendarAccountsPanel() {
  const {
    data: accounts = [],
    isLoading: accountsLoading,
    mutate: mutateAccounts,
  } = useSWR("/calendar-accounts", fetchCalendarAccountStatuses, {
    refreshInterval: (data) =>
      data?.some((a) => a.status === "reauth_pending")
        ? POLL_WHILE_PENDING_MS
        : 0,
  });
  const {
    data: calendars = [],
    isLoading: calendarsLoading,
    mutate: mutateCalendars,
  } = useSWR("/calendars", fetchCalendars, {
    refreshInterval: (data) =>
      data?.some((c) => c.syncing) ? POLL_WHILE_SYNCING_MS : 0,
  });
  const { colorForSource, setSourceColor } = useCalendarColors();
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const calendarsByAccount = useMemo(() => {
    const map = new Map<string, CalendarStatus[]>();
    for (const calendar of calendars) {
      const key = accountKey(calendar.provider, calendar.accountLabel);
      const list = map.get(key) ?? [];
      list.push(calendar);
      map.set(key, list);
    }
    return map;
  }, [calendars]);

  function refresh() {
    mutateAccounts();
    mutateCalendars();
  }

  async function handleReauth(accountLabel: string, provider: CalendarAccountStatus["provider"]) {
    try {
      const authUrl = await startCalendarAccountReauth(accountLabel, provider);
      window.open(authUrl, "_blank", "noopener,noreferrer");
      mutateAccounts();
    } catch (error) {
      message.error(`Failed to start sign-in for "${accountLabel}"`);
      console.error(error);
    }
  }

  // Both toggles below update just the one field optimistically and, on
  // failure, revert that same field rather than doing a full revalidate —
  // a revalidate re-fetches every calendar's real state, which would also
  // surface OTHER calendars' background-poll-driven lastSyncedAt changes,
  // making it look like this toggle had synced calendars it never touched.

  async function handleToggleEnabled(calendarId: string, enabled: boolean) {
    mutateCalendars(
      (current) =>
        current?.map((c) => (c.calendarId === calendarId ? { ...c, enabled } : c)),
      { revalidate: false },
    );
    try {
      await setCalendarEnabled(calendarId, enabled);
    } catch (error) {
      message.error(`Failed to ${enabled ? "enable" : "disable"} the calendar`);
      console.error(error);
      mutateCalendars(
        (current) =>
          current?.map((c) => (c.calendarId === calendarId ? { ...c, enabled: !enabled } : c)),
        { revalidate: false },
      );
    }
  }

  async function handleToggleIncludedInBusy(calendarId: string, includedInBusy: boolean) {
    mutateCalendars(
      (current) =>
        current?.map((c) =>
          c.calendarId === calendarId ? { ...c, includedInBusy } : c,
        ),
      { revalidate: false },
    );
    try {
      await setCalendarIncludedInBusy(calendarId, includedInBusy);
    } catch (error) {
      message.error(
        `Failed to ${includedInBusy ? "include" : "exclude"} the calendar in busy status`,
      );
      console.error(error);
      mutateCalendars(
        (current) =>
          current?.map((c) =>
            c.calendarId === calendarId ? { ...c, includedInBusy: !includedInBusy } : c,
          ),
        { revalidate: false },
      );
    }
  }

  async function handleSync(calendarId: string) {
    const ok = await triggerCalendarSync(calendarId);

    if (ok) {
      // The real `syncing` flag only shows up on the next GET /calendars —
      // set it optimistically so the button/row react immediately, and let
      // the poll-while-syncing SWR interval above pick up when it actually
      // finishes rather than guessing at a timeout here.
      mutateCalendars(
        (current) =>
          current?.map((c) => (c.calendarId === calendarId ? { ...c, syncing: true } : c)),
        { revalidate: false },
      );
      message.success(`Sync triggered for "${calendarId}"`);
    } else {
      message.error(`Failed to trigger sync for "${calendarId}"`);
    }
  }

  async function handleRemove(calendarId: string) {
    try {
      await removeCalendar(calendarId);
      mutateCalendars();
    } catch (error) {
      message.error(`Failed to remove "${calendarId}"`);
      console.error(error);
    }
  }

  return (
    <Card
      title="Calendar Accounts"
      extra={
        <Space size="small">
          <Tooltip title="Add account">
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => setAddAccountOpen(true)}
              aria-label="Add account"
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={accountsLoading || calendarsLoading}
              aria-label="Refresh"
            />
          </Tooltip>
        </Space>
      }
    >
      <Table<CalendarAccountStatus>
        rowKey={(account) => accountKey(account.provider, account.accountLabel)}
        loading={accountsLoading}
        dataSource={accounts}
        pagination={false}
        size="small"
        expandable={{
          // A freshly authorized account has no calendars yet — it still
          // needs to be expandable so its first one can be discovered/added.
          rowExpandable: (account) =>
            account.status === "ok" ||
            (calendarsByAccount.get(accountKey(account.provider, account.accountLabel))?.length ?? 0) > 0,
          expandedRowRender: (account) => (
            <AccountCalendarsTable
              account={account}
              tracked={calendarsByAccount.get(accountKey(account.provider, account.accountLabel)) ?? []}
              colorForSource={colorForSource}
              onSetSourceColor={setSourceColor}
              onSync={handleSync}
              onToggleEnabled={handleToggleEnabled}
              onToggleIncludedInBusy={handleToggleIncludedInBusy}
              onRemove={handleRemove}
              onCalendarAdded={mutateCalendars}
            />
          ),
        }}
        columns={[
          { title: "Account", dataIndex: "accountLabel" },
          {
            title: "Provider",
            key: "provider",
            render: (_, record) => {
              const meta = PROVIDER_META[record.provider];
              return (
                <Space size="small">
                  {meta.icon}
                  <span>{meta.label}</span>
                </Space>
              );
            },
          },
          {
            title: "Last authorized",
            dataIndex: "obtainedAt",
            render: (value?: string) =>
              value ? new Date(value).toLocaleString() : "—",
          },
          {
            title: "Status",
            key: "status",
            render: (_, record) => {
              const tag = STATUS_TAG[record.status];
              const detail = detailFor(record);
              return (
                <div>
                  <Tag color={tag.color}>{tag.label}</Tag>
                  {detail && (
                    <Typography.Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12, marginTop: 2 }}
                    >
                      {detail}
                    </Typography.Text>
                  )}
                </div>
              );
            },
          },
          {
            title: "Calendars",
            key: "calendarCount",
            render: (_, account) => (
              <AccountCalendarCount
                account={account}
                tracked={calendarsByAccount.get(accountKey(account.provider, account.accountLabel)) ?? []}
              />
            ),
          },
          {
            title: "",
            key: "actions",
            render: (_, record) =>
              NEEDS_REAUTH.includes(record.status) ? (
                <Button
                  size="small"
                  onClick={() => handleReauth(record.accountLabel, record.provider)}
                >
                  {record.status === "not_connected" ? "Sign in" : "Reauthorize"}
                </Button>
              ) : record.status === "reauth_pending" ? (
                <Button size="small" loading disabled>
                  Waiting…
                </Button>
              ) : null,
          },
        ]}
      />
      <AddAccountModal
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        onAdded={mutateAccounts}
      />
    </Card>
  );
}

type AddAccountFlow =
  | { phase: "idle" }
  | { phase: "pending"; transactionId: string }
  | { phase: "error"; message: string };

function AddAccountModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [flow, setFlow] = useState<AddAccountFlow>({ phase: "idle" });

  useSWR(
    flow.phase === "pending" ? ["/calendar-accounts/new", flow.phase, flow.transactionId] : null,
    ([, , transactionId]) => fetchNewAccountAuthStatus(transactionId),
    {
      refreshInterval: POLL_NEW_ACCOUNT_AUTH_MS,
      onSuccess: (status) => {
        if (status.status === "success") {
          message.success(`Connected "${status.accountLabel}"`);
          onAdded();
          handleClose();
        } else if (status.status === "error") {
          setFlow({ phase: "error", message: status.error ?? "Authorization failed" });
        }
      },
    },
  );

  function handleClose() {
    setFlow({ phase: "idle" });
    onClose();
  }

  async function handleSelectProvider(provider: CalendarAccountStatus["provider"]) {
    try {
      const { transactionId, authUrl } = await startNewAccountAuth(provider);
      window.open(authUrl, "_blank", "noopener,noreferrer");
      setFlow({ phase: "pending", transactionId });
    } catch (error) {
      message.error("Failed to start sign-in");
      console.error(error);
    }
  }

  return (
    <Modal title="Add a calendar account" open={open} onCancel={handleClose} footer={null}>
      {flow.phase === "pending" ? (
        <Flex vertical align="center" gap={12} style={{ padding: "24px 0" }}>
          <Spin />
          <Typography.Text>Waiting for sign-in in the tab that opened…</Typography.Text>
        </Flex>
      ) : (
        <Flex vertical gap={8}>
          {flow.phase === "error" && <Alert type="error" showIcon message={flow.message} />}
          <Button
            size="large"
            icon={<GoogleOutlined />}
            onClick={() => handleSelectProvider("google")}
            style={{ justifyContent: "flex-start" }}
          >
            Google
          </Button>
          <Button
            size="large"
            icon={<WindowsOutlined />}
            onClick={() => handleSelectProvider("microsoft")}
            style={{ justifyContent: "flex-start" }}
          >
            Office 365
          </Button>
        </Flex>
      )}
    </Modal>
  );
}

/**
 * "N calendars available, M enabled" for an account's collapsed row —
 * "available" is every calendar Google reports (tracked or not), so this
 * shares the same `/calendar-accounts/{label}/available-calendars` SWR key
 * (and thus request/cache) as AccountCalendarsTable's own fetch below,
 * whether or not that row happens to be expanded right now.
 */
function AccountCalendarCount({
  account,
  tracked,
}: {
  account: CalendarAccountStatus;
  tracked: CalendarStatus[];
}) {
  const { data: available = [] } = useSWR(
    account.status === "ok"
      ? ["/calendar-accounts/available-calendars", account.provider, account.accountLabel]
      : null,
    ([, provider, label]) => fetchAvailableCalendars(label, provider),
  );

  const trackedIds = new Set(tracked.map((c) => c.calendarId));
  const untrackedCount = available.filter(
    (c) => !c.alreadySynced && !trackedIds.has(c.id),
  ).length;
  const totalAvailable = tracked.length + untrackedCount;
  const enabledCount = tracked.filter((c) => c.enabled).length;

  return (
    <span>
      {totalAvailable} calendar{totalAvailable === 1 ? "" : "s"} available, {enabledCount} enabled
    </span>
  );
}

function AccountCalendarsTable({
  account,
  tracked,
  colorForSource,
  onSetSourceColor,
  onSync,
  onToggleEnabled,
  onToggleIncludedInBusy,
  onRemove,
  onCalendarAdded,
}: {
  account: CalendarAccountStatus;
  tracked: CalendarStatus[];
  colorForSource: (source: string) => string;
  onSetSourceColor: (source: string, color: string) => void;
  onSync: (calendarId: string) => void;
  onToggleEnabled: (calendarId: string, enabled: boolean) => void;
  onToggleIncludedInBusy: (calendarId: string, includedInBusy: boolean) => void;
  onRemove: (calendarId: string) => void;
  onCalendarAdded: () => void;
}) {
  // Discovering an account's full calendar list only makes sense once it's
  // actually connected — an invalid/missing token would just 404/error.
  const {
    data: available = [],
    isLoading: availableLoading,
    mutate: mutateAvailable,
  } = useSWR(
    account.status === "ok"
      ? ["/calendar-accounts/available-calendars", account.provider, account.accountLabel]
      : null,
    ([, provider, label]) => fetchAvailableCalendars(label, provider),
  );
  const [addingId, setAddingId] = useState<string | null>(null);

  const rows: CalendarRow[] = useMemo(() => {
    // `available` can briefly lag behind `tracked` right after an add (its
    // own revalidation is a separate request) — filter by the client's own
    // tracked ids too, not just the server's `alreadySynced`, so the two
    // lists never render the same calendarId at once.
    const trackedIds = new Set(tracked.map((c) => c.calendarId));
    const untracked = available
      .filter((c) => !c.alreadySynced && !trackedIds.has(c.id))
      .map((c): CalendarRow => ({ tracked: false, calendarId: c.id, source: c.summary }));
    return [...tracked.map((c): CalendarRow => ({ ...c, tracked: true })), ...untracked];
  }, [tracked, available]);

  async function handleAdd(calendarId: string, source: string) {
    setAddingId(calendarId);
    try {
      await addCalendar({ provider: account.provider, accountLabel: account.accountLabel, calendarId, source });
      message.success(`Added "${source}"`);
      mutateAvailable();
      onCalendarAdded();
    } catch (error) {
      message.error(`Failed to add "${source}"`);
      console.error(error);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Table<CalendarRow>
      rowKey="calendarId"
      loading={availableLoading}
      dataSource={rows}
      pagination={false}
      size="small"
      columns={[
        {
          title: "Source",
          key: "source",
          width: SOURCE_COLUMN_WIDTH,
          render: (_, row) => (
            <Flex align="center" gap={8}>
              {row.tracked && row.enabled ? (
                <ColorPicker
                  value={colorForSource(row.source)}
                  onChange={(color) => onSetSourceColor(row.source, color.toHexString())}
                >
                  <div
                    style={{
                      width: SOURCE_SWATCH_SIZE,
                      height: SOURCE_SWATCH_SIZE,
                      flexShrink: 0,
                      borderRadius: 6,
                      backgroundColor: colorForSource(row.source),
                      border: "1px solid rgba(0, 0, 0, 0.15)",
                      cursor: "pointer",
                    }}
                  />
                </ColorPicker>
              ) : (
                // Reserves the swatch's space so names line up whether or not this row has one.
                <div style={{ width: SOURCE_SWATCH_SIZE, flexShrink: 0 }} />
              )}
              <span style={{ whiteSpace: "nowrap" }}>{row.source}</span>
            </Flex>
          ),
        },
        {
          title: "Calendar ID",
          key: "calendarId",
          // No fixed width — this is the one column that should absorb
          // whatever space the fixed-width columns around it leave over.
          ellipsis: true,
          render: (_, row) => (
            <span
              style={{
                display: "block",
                fontFamily: "monospace",
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={row.calendarId}
            >
              {row.calendarId}
            </span>
          ),
        },
        {
          title: "Status",
          key: "enabled",
          width: INFO_COLUMN_WIDTH,
          render: (_, row) => {
            const tag = row.tracked
              ? row.enabled
                ? { color: "green", label: "Enabled" }
                : { color: "red", label: "Disabled" }
              : { color: "default", label: "Not synchronized" };
            return (
              <Tag color={tag.color} style={{ width: STATUS_TAG_WIDTH, textAlign: "center" }}>
                {tag.label}
              </Tag>
            );
          },
        },
        {
          title: "Last synced",
          key: "lastSyncedAt",
          width: INFO_COLUMN_WIDTH,
          render: (_, row) =>
            row.tracked ? (
              <Link
                href={`/sync?calendarId=${encodeURIComponent(row.calendarId)}`}
                style={{ fontSize: 12 }}
              >
                {row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : "Never"}
              </Link>
            ) : (
              <span style={{ fontSize: 12 }}>—</span>
            ),
        },
        {
          title: "Included in busy",
          key: "includedInBusy",
          width: BUSY_INCLUSION_COLUMN_WIDTH,
          render: (_, row) =>
            row.tracked && row.enabled ? (
              <Switch
                checked={row.includedInBusy}
                disabled={row.syncing}
                onChange={(checked) => onToggleIncludedInBusy(row.calendarId, checked)}
              />
            ) : null,
        },
        {
          title: "",
          key: "actions",
          align: "right",
          width: ACTIONS_COLUMN_WIDTH,
          render: (_, row) => {
            const enabled = row.tracked && row.enabled;
            const syncing = row.tracked && row.syncing;
            return (
              <Flex gap={8} justify="flex-end">
                {row.tracked ? (
                  <Popconfirm
                    title="Stop syncing this calendar?"
                    description="It can be added back later by enabling it again."
                    onConfirm={() => onRemove(row.calendarId)}
                  >
                    <Button size="small" danger disabled={syncing} style={{ width: REMOVE_BUTTON_WIDTH }}>
                      Remove
                    </Button>
                  </Popconfirm>
                ) : (
                  // Reserves Remove's slot so Sync now/Enable line up across rows regardless.
                  <div style={{ width: REMOVE_BUTTON_WIDTH, flexShrink: 0 }} />
                )}
                {row.tracked ? (
                  <Button
                    size="small"
                    icon={<SyncOutlined />}
                    style={{ width: SYNC_BUTTON_WIDTH }}
                    loading={syncing}
                    onClick={() => onSync(row.calendarId)}
                  >
                    Sync now
                  </Button>
                ) : (
                  <div style={{ width: SYNC_BUTTON_WIDTH, flexShrink: 0 }} />
                )}
                <Button
                  size="small"
                  type="primary"
                  danger={enabled}
                  icon={enabled ? <StopOutlined /> : <CheckOutlined />}
                  style={{ width: ENABLE_TOGGLE_BUTTON_WIDTH }}
                  disabled={syncing}
                  loading={!row.tracked && addingId === row.calendarId}
                  onClick={() =>
                    row.tracked
                      ? onToggleEnabled(row.calendarId, !row.enabled)
                      : handleAdd(row.calendarId, row.source)
                  }
                >
                  {enabled ? "Disable" : "Enable"}
                </Button>
              </Flex>
            );
          },
        },
      ]}
    />
  );
}
