import type {
  AvailableCalendar,
  CalendarAccount,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Flex,
  Input,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import React, { useEffect, useMemo, useState } from "react";
import calendarsApi from "../../../api/calendarsApi";
import { apiProblems } from "../../../utils/goals";
import {
  PROVIDER_NAMES,
  sourceProblem,
  suggestSource,
} from "../../../utils/calendars";

const { Text, Paragraph } = Typography;

type Pick = { checked: boolean; source: string };

/**
 * The calendars an account's provider lists, to pick which to sync and
 * label each (the chosen canvas's drawer). Labels are checked here against
 * the user's own; the API answers 409 for one another user's calendar has.
 */
const AddCalendarsDrawer: React.FunctionComponent<{
  account?: CalendarAccount;
  /** Labels the user's synced calendars already have. */
  takenSources: string[];
  onClose: () => void;
  onAdded: () => void;
}> = ({ account, takenSources, onClose, onAdded }) => {
  const [available, setAvailable] = useState<AvailableCalendar[]>();
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [problem, setProblem] = useState<string>();
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!account) return;
    setAvailable(undefined);
    setPicks({});
    setProblem(undefined);
    setRefused({});
    calendarsApi
      .listAvailable(account.id)
      .then((calendars) => {
        setAvailable(calendars);
        setPicks(
          Object.fromEntries(
            calendars.map((c) => [
              c.calendarId,
              { checked: false, source: suggestSource(c.name) },
            ]),
          ),
        );
      })
      .catch((error) => setProblem(apiProblems(error).join(" ")));
  }, [account]);

  const picked = Object.entries(picks).filter(([, p]) => p.checked);

  /** Each picked calendar's problem, against the synced labels and the other picks. */
  const problems = useMemo(
    () =>
      Object.fromEntries(
        picked.map(([calendarId, pick]) => [
          calendarId,
          refused[calendarId] ??
            sourceProblem(pick.source, [
              ...takenSources,
              ...picked
                .filter(([other]) => other !== calendarId)
                .map(([, p]) => p.source.trim()),
            ]),
        ]),
      ),
    [picked, takenSources, refused],
  );
  const blocked = Object.values(problems).some(Boolean);

  const add = async () => {
    if (!account) return;
    setAdding(true);
    const failed: Record<string, string> = {};
    for (const [calendarId, pick] of picked) {
      try {
        await calendarsApi.addCalendar(
          account.id,
          calendarId,
          pick.source.trim(),
        );
        setPicks((current) => {
          const next = { ...current };
          delete next[calendarId];
          return next;
        });
      } catch (error) {
        failed[calendarId] = apiProblems(error).join(" ");
      }
    }
    setAdding(false);
    setRefused(failed);
    onAdded();
    if (Object.keys(failed).length === 0) onClose();
  };

  const provider = account
    ? (PROVIDER_NAMES[account.provider] ?? account.provider)
    : "";

  return (
    <Drawer
      open={account !== undefined}
      onClose={onClose}
      title={account ? `Add calendars · ${account.email}` : "Add calendars"}
      size={520}
      footer={
        <Flex justify={"flex-end"} gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type={"primary"}
            disabled={picked.length === 0 || blocked}
            loading={adding}
            onClick={add}
          >
            {picked.length === 1
              ? "Add 1 calendar"
              : `Add ${picked.length} calendars`}
          </Button>
        </Flex>
      }
    >
      <Paragraph type={"secondary"}>
        The calendars {provider} lists for this account. Pick the ones to sync,
        and give each a short label: it&apos;s how its meetings show their
        source in Minerva.
      </Paragraph>
      {problem && <Alert type={"error"} showIcon={true} title={problem} />}
      {!problem && available === undefined && (
        <Skeleton active={true} paragraph={{ rows: 6 }} />
      )}
      {available?.length === 0 && (
        <Empty
          description={`${provider} lists no calendars for this account.`}
        />
      )}
      {available?.map((calendar) => {
        const pick = picks[calendar.calendarId];
        const error = problems[calendar.calendarId];
        return (
          <Flex
            key={calendar.calendarId}
            gap={12}
            align={"flex-start"}
            style={{ padding: "14px 0", borderBottom: "1px solid #f0f0f0" }}
          >
            <Checkbox
              checked={calendar.synced || pick?.checked}
              disabled={calendar.synced}
              onChange={(e) =>
                setPicks((current) => ({
                  ...current,
                  [calendar.calendarId]: {
                    source: current[calendar.calendarId]?.source ?? "",
                    checked: e.target.checked,
                  },
                }))
              }
              aria-label={calendar.name}
              style={{ marginTop: 2 }}
            />
            <Flex vertical={true} gap={2} style={{ flex: 1, minWidth: 0 }}>
              <span>{calendar.name}</span>
              <Text type={"secondary"} style={{ fontSize: 12 }}>
                {calendar.calendarId}
              </Text>
              {pick?.checked && (
                <Flex vertical={true} gap={4} style={{ marginTop: 8 }}>
                  <Text type={"secondary"} style={{ fontSize: 12 }}>
                    Label
                  </Text>
                  <Input
                    value={pick.source}
                    maxLength={64}
                    status={error ? "error" : undefined}
                    style={{ width: 240 }}
                    aria-label={`Label for ${calendar.name}`}
                    onChange={(e) => {
                      const source = e.target.value;
                      setRefused((current) => {
                        const next = { ...current };
                        delete next[calendar.calendarId];
                        return next;
                      });
                      setPicks((current) => ({
                        ...current,
                        [calendar.calendarId]: { checked: true, source },
                      }));
                    }}
                  />
                  {error && (
                    <Text type={"danger"} style={{ fontSize: 12 }}>
                      {error}
                    </Text>
                  )}
                </Flex>
              )}
            </Flex>
            {calendar.synced && <Tag>Synced</Tag>}
          </Flex>
        );
      })}
    </Drawer>
  );
};

export default AddCalendarsDrawer;
