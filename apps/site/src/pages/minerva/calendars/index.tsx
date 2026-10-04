import type {
  Calendar,
  CalendarAccount,
  CalendarProvider,
} from "@ncfritz/olympus-sdk/minerva";
import {
  DownOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Flex,
  message,
  Modal,
  Skeleton,
  Typography,
} from "antd";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import calendarsApi from "../../../api/calendarsApi";
import AccountCard, {
  type CalendarChange,
} from "../../../components/minerva/calendars/AccountCard";
import AddCalendarsDrawer from "../../../components/minerva/calendars/AddCalendarsDrawer";
import CalendarsBreadcrumbs from "../../../components/minerva/calendars/CalendarsBreadcrumbs";
import ClaimModal from "../../../components/minerva/calendars/ClaimModal";
import {
  calendarsByAccount,
  calendarsReturnTo,
  PROVIDER_NAMES,
  SIGN_IN_OUTCOME_KEYS,
  type SignInOutcome,
  signInOutcome,
} from "../../../utils/calendars";
import { apiProblems } from "../../../utils/goals";

const { Title, Text } = Typography;

/**
 * Calendars (ADR 0028, the chosen canvas's option A): the user's calendar
 * accounts, each with its calendars beneath it; connecting, re-authorizing,
 * claiming and removing accounts; and each calendar's sync, busy and color.
 */
const CalendarsPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [accounts, setAccounts] = useState<CalendarAccount[]>();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [agentDown, setAgentDown] = useState(false);
  const [loadProblem, setLoadProblem] = useState<string>();
  const [outcome, setOutcome] = useState<SignInOutcome>();
  const [adding, setAdding] = useState<CalendarAccount>();
  const [removing, setRemoving] = useState<CalendarAccount>();
  const [removingBusy, setRemovingBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [saving, setSaving] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const listed = await calendarsApi.listAccounts();
      setAccounts(listed);
      setLoadProblem(undefined);
      // Every status unknown: the API could not ask the calendar sync.
      const down =
        listed.length > 0 && listed.every((a) => a.status === "unknown");
      setAgentDown(down);
      if (!down && listed.length > 0) {
        try {
          setCalendars(await calendarsApi.listCalendars());
        } catch {
          setAgentDown(true);
        }
      }
    } catch (error) {
      setLoadProblem(apiProblems(error).join(" "));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // What the provider's sign-in came back with, shown once.
  useEffect(() => {
    if (!router.isReady) return;
    const said = signInOutcome(router.query);
    if (!said) return;
    setOutcome(said);
    const query = { ...router.query };
    for (const key of SIGN_IN_OUTCOME_KEYS) delete query[key];
    void router.replace({ query }, undefined, { shallow: true });
  }, [router.isReady, router.query, router]);

  const groups = useMemo(
    () => calendarsByAccount(accounts ?? [], calendars),
    [accounts, calendars],
  );

  const signIn = async (start: () => Promise<string>) => {
    try {
      window.location.assign(await start());
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    }
  };
  const connect = (provider: CalendarProvider) =>
    signIn(() =>
      calendarsApi.connect(provider, calendarsReturnTo(window.location.origin)),
    );
  const reauthorize = (account: CalendarAccount) =>
    signIn(() =>
      calendarsApi.reauthorize(
        account.id,
        calendarsReturnTo(window.location.origin),
      ),
    );

  const changeCalendar = async (calendar: Calendar, change: CalendarChange) => {
    const id = calendar.calendarId;
    // Shown at once; put back if the API refuses.
    setCalendars((current) =>
      current.map((c) => (c.calendarId === id ? { ...c, ...change } : c)),
    );
    setSaving((current) => [...current, id]);
    try {
      const updated = await calendarsApi.updateCalendar(id, change);
      setCalendars((current) =>
        current.map((c) => (c.calendarId === id ? updated : c)),
      );
    } catch (error) {
      setCalendars((current) =>
        current.map((c) => (c.calendarId === id ? calendar : c)),
      );
      message.error(apiProblems(error).join(" "));
    } finally {
      setSaving((current) => current.filter((c) => c !== id));
    }
  };

  const removeCalendar = async (calendar: Calendar) => {
    try {
      await calendarsApi.removeCalendar(calendar.calendarId);
      setCalendars((current) =>
        current.filter((c) => c.calendarId !== calendar.calendarId),
      );
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    }
  };

  const removeAccount = async () => {
    if (!removing) return;
    setRemovingBusy(true);
    try {
      await calendarsApi.removeAccount(removing.id);
      setRemoving(undefined);
      await load();
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setRemovingBusy(false);
    }
  };

  const removingCalendars = removing
    ? calendars.filter((c) => c.accountId === removing.id)
    : [];
  const outcomeAccount = accounts?.find((a) => a.id === outcome?.accountId);

  return (
    <>
      <CalendarsBreadcrumbs />
      <div
        style={{
          height: "calc(100vh - 92px)",
          overflowX: "hidden",
          overflowY: "auto",
          padding: "8px 24px 48px",
        }}
      >
        <Flex
          justify={"space-between"}
          align={"center"}
          wrap={true}
          gap={12}
          style={{ marginBottom: 16 }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Calendars
          </Title>
          <Flex gap={8} wrap={true}>
            <Button onClick={() => setClaiming(true)}>Claim an account</Button>
            <Dropdown
              menu={{
                items: (Object.keys(PROVIDER_NAMES) as CalendarProvider[]).map(
                  (provider) => ({
                    key: provider,
                    label: PROVIDER_NAMES[provider],
                  }),
                ),
                onClick: ({ key }) => void connect(key as CalendarProvider),
              }}
              disabled={agentDown}
            >
              <Button type={"primary"} icon={<PlusOutlined />}>
                Connect account <DownOutlined />
              </Button>
            </Dropdown>
          </Flex>
        </Flex>

        {outcome && (
          <Alert
            type={outcome.type}
            showIcon={true}
            closable={{ onClose: () => setOutcome(undefined) }}
            style={{ marginBottom: 16 }}
            title={outcome.title}
            description={
              <span>
                {outcome.description}{" "}
                {outcomeAccount && (
                  <Button
                    type={"link"}
                    size={"small"}
                    style={{ padding: 0 }}
                    onClick={() => {
                      setAdding(outcomeAccount);
                      setOutcome(undefined);
                    }}
                  >
                    Add calendars
                  </Button>
                )}
              </span>
            }
          />
        )}
        {agentDown && (
          <Alert
            type={"warning"}
            showIcon={true}
            style={{ marginBottom: 16 }}
            title={
              "The calendar sync isn't answering, so your accounts are listed without their status, and calendars can't be changed right now."
            }
          />
        )}
        {loadProblem && (
          <Alert
            type={"error"}
            showIcon={true}
            style={{ marginBottom: 16 }}
            title={loadProblem}
          />
        )}

        {accounts === undefined && !loadProblem && (
          <Skeleton active={true} paragraph={{ rows: 8 }} />
        )}
        {accounts?.length === 0 && (
          <Empty
            style={{ margin: "48px 0" }}
            description={
              "No calendar accounts yet. Connect one to bring its meetings into Minerva."
            }
          />
        )}
        {groups.map(({ account, calendars: own }) => (
          <AccountCard
            key={account.id}
            account={account}
            calendars={own}
            agentDown={agentDown}
            saving={saving}
            onAddCalendars={() => setAdding(account)}
            onReauthorize={() => void reauthorize(account)}
            onRemove={() => setRemoving(account)}
            onChangeCalendar={(calendar, change) =>
              void changeCalendar(calendar, change)
            }
            onRemoveCalendar={(calendar) => void removeCalendar(calendar)}
          />
        ))}

        {accounts !== undefined && (
          <Text type={"secondary"}>
            <InfoCircleOutlined /> An account the calendar sync already has, but
            isn&apos;t yours here yet?{" "}
            <Button
              type={"link"}
              size={"small"}
              style={{ padding: 0 }}
              onClick={() => setClaiming(true)}
            >
              Claim it by its email
            </Button>
            , or connect it and sign in.
          </Text>
        )}
      </div>

      <AddCalendarsDrawer
        account={adding}
        takenSources={calendars.map((c) => c.source)}
        onClose={() => setAdding(undefined)}
        onAdded={() => void load()}
      />
      <ClaimModal open={claiming} onClose={() => setClaiming(false)} />
      <Modal
        open={removing !== undefined}
        title={removing ? `Remove ${removing.email}?` : undefined}
        okText={"Remove account"}
        okButtonProps={{ danger: true, loading: removingBusy }}
        onOk={() => void removeAccount()}
        onCancel={() => setRemoving(undefined)}
        width={480}
      >
        <p style={{ color: "rgba(0,0,0,.65)" }}>
          Olympus stops syncing it and forgets its sign-in.
        </p>
        <ul style={{ paddingLeft: 18, color: "rgba(0,0,0,.65)" }}>
          {removingCalendars.length > 0 && (
            <li>
              <Text strong={true}>
                {removingCalendars.length === 1
                  ? "1 calendar"
                  : `${removingCalendars.length} calendars`}
              </Text>{" "}
              {removingCalendars.length === 1 ? "stops" : "stop"} syncing (
              {removingCalendars.map((c) => c.source).join(", ")}).
            </li>
          )}
          <li>
            <Text strong={true}>Its meetings</Text> leave your Minerva calendar.
          </li>
          <li>
            <Text strong={true}>Your notes stay</Text>, with their links to
            those meetings: connect the account again and they find their
            meetings again.
          </li>
        </ul>
      </Modal>
    </>
  );
};

export default CalendarsPage;
