import type { Calendar, CalendarAccount } from "@ncfritz/olympus-sdk/minerva";
import { WarningOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  ColorPicker,
  Flex,
  Popconfirm,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import React from "react";
import {
  accountMeta,
  accountState,
  calendarColor,
  CALENDAR_COLORS,
  lastSyncedText,
  PROVIDER_BADGES,
  PROVIDER_NAMES,
} from "../../../utils/calendars";

const { Text } = Typography;

export type CalendarChange = {
  enabled?: boolean;
  includedInBusy?: boolean;
  color?: string;
};

/**
 * One calendar account and its calendars beneath it (the chosen canvas,
 * option A): its state, its actions, and each calendar's switches and
 * color.
 */
const AccountCard: React.FunctionComponent<{
  account: CalendarAccount;
  calendars: Calendar[];
  /** The calendar sync could not be asked: nothing can be changed. */
  agentDown: boolean;
  /** Calendar IDs with a change in flight. */
  saving: string[];
  onAddCalendars: () => void;
  onReauthorize: () => void;
  onRemove: () => void;
  onChangeCalendar: (calendar: Calendar, change: CalendarChange) => void;
  onRemoveCalendar: (calendar: Calendar) => void;
}> = ({
  account,
  calendars,
  agentDown,
  saving,
  onAddCalendars,
  onReauthorize,
  onRemove,
  onChangeCalendar,
  onRemoveCalendar,
}) => {
  const state = accountState(account.status);
  const provider = PROVIDER_NAMES[account.provider] ?? account.provider;
  const badge = PROVIDER_BADGES[account.provider];
  const locked = agentDown || !state.canChangeCalendars;
  const explanation =
    state.explanation?.(provider) ??
    (account.status === "error" && account.error
      ? `The calendar sync reports: ${account.error}`
      : undefined);

  return (
    <Card
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 0 } }}
      title={
        <Flex
          gap={12}
          align={"center"}
          wrap={true}
          style={{ padding: "6px 0" }}
        >
          <span
            aria-hidden={true}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: badge?.color ?? "#8c8c8c",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {badge?.letter ?? "?"}
          </span>
          <Flex vertical={true} style={{ minWidth: 220 }}>
            <Text strong={true} style={{ fontSize: 16 }}>
              {account.email}
            </Text>
            <Text type={"secondary"} style={{ fontSize: 12, fontWeight: 400 }}>
              {accountMeta(account)}
            </Text>
          </Flex>
        </Flex>
      }
      extra={
        <Flex gap={8} align={"center"} wrap={true}>
          <Tag color={state.color}>{state.label}</Tag>
          {state.needsSignIn && !agentDown && (
            <Button size={"small"} type={"primary"} onClick={onReauthorize}>
              {account.status === "not_connected" ? "Sign in" : "Re-authorize"}
            </Button>
          )}
          <Button size={"small"} disabled={locked} onClick={onAddCalendars}>
            Add calendars
          </Button>
          {!state.needsSignIn && (
            <Button
              size={"small"}
              type={"text"}
              disabled={agentDown}
              onClick={onReauthorize}
            >
              Re-authorize
            </Button>
          )}
          <Button
            size={"small"}
            type={"text"}
            danger={true}
            disabled={agentDown}
            onClick={onRemove}
          >
            Remove
          </Button>
        </Flex>
      }
    >
      {explanation && (
        <div style={{ padding: "16px 24px 0" }}>
          <Alert
            type={account.status === "error" ? "error" : "warning"}
            showIcon={true}
            icon={<WarningOutlined />}
            title={explanation}
          />
        </div>
      )}
      <Table<Calendar>
        rowKey={"calendarId"}
        dataSource={calendars}
        pagination={false}
        scroll={{ x: 720 }}
        locale={{
          emptyText: locked
            ? "No calendars synced."
            : "No calendars synced yet. Add calendars to start.",
        }}
        columns={[
          {
            title: "Calendar",
            key: "calendar",
            render: (_, calendar) => (
              <Flex gap={10} align={"center"}>
                <ColorPicker
                  size={"small"}
                  value={calendarColor(calendar)}
                  disabledAlpha={true}
                  presets={[{ label: "Colors", colors: CALENDAR_COLORS }]}
                  onChangeComplete={(c) =>
                    onChangeCalendar(calendar, { color: c.toHexString() })
                  }
                  aria-label={`${calendar.source} color`}
                />
                <Flex vertical={true}>
                  <span>{calendar.source}</span>
                  <Text type={"secondary"} style={{ fontSize: 12 }}>
                    {calendar.calendarId}
                  </Text>
                </Flex>
              </Flex>
            ),
          },
          {
            title: "Sync",
            key: "enabled",
            render: (_, calendar) => (
              <Flex gap={8} align={"center"}>
                <Switch
                  checked={calendar.enabled}
                  disabled={locked}
                  loading={saving.includes(calendar.calendarId)}
                  onChange={(enabled) =>
                    onChangeCalendar(calendar, { enabled })
                  }
                  aria-label={`Sync ${calendar.source}`}
                />
                {!calendar.enabled && <Tag>Paused</Tag>}
              </Flex>
            ),
          },
          {
            title: "Counts toward busy",
            key: "includedInBusy",
            render: (_, calendar) => (
              <Switch
                checked={calendar.includedInBusy}
                disabled={locked}
                loading={saving.includes(calendar.calendarId)}
                onChange={(includedInBusy) =>
                  onChangeCalendar(calendar, { includedInBusy })
                }
                aria-label={`${calendar.source} counts toward busy`}
              />
            ),
          },
          {
            title: "Last synced",
            key: "lastSynced",
            render: (_, calendar) =>
              state.needsSignIn && account.status !== "reauth_pending" ? (
                <Tag color={"warning"}>Stopped</Tag>
              ) : (
                <span>{lastSyncedText(calendar)}</span>
              ),
          },
          {
            title: "",
            key: "actions",
            align: "right",
            render: (_, calendar) => (
              <Popconfirm
                title={`Stop syncing ${calendar.source}?`}
                description={"Its meetings already in Minerva stay."}
                okText={"Stop syncing"}
                okButtonProps={{ danger: true }}
                onConfirm={() => onRemoveCalendar(calendar)}
                disabled={locked}
              >
                <Button type={"link"} disabled={locked}>
                  Stop syncing
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default AccountCard;
