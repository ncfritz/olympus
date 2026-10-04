import {
  CalendarOutlined,
  LeftOutlined,
  RadarChartOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Col,
  Flex,
  Radio,
  Row,
  Space,
  Statistic,
  type TabsProps,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useMemo } from "react";
import {
  formatMinutes,
  meetingsHref,
  type MeetingsView,
  periodOf,
  periodStatistics,
  stepPeriod,
} from "../../../utils/meetings";
import { CALENDARS_PATH } from "../../../utils/calendars";
import CollapsibleTabPanel from "../../layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../layout/OlympusBreadcrumbs";

const { Title, Text } = Typography;

/** The header and breadcrumbs above the page, as the goals pages measure them. */
const PAGE_HEIGHT = "calc(100vh - 92px)";

const CELL: React.CSSProperties = {
  borderRight: "1px solid #f0f0f0",
  padding: 16,
};

const VIEW_LABEL: Record<MeetingsView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export interface MeetingsPageProps {
  view: MeetingsView;
  /** The day the view is of. */
  date: DateTime;
  /** The period's meetings, for its numbers; undefined while they load. */
  items?: Meeting[];
  /** The side panel's tabs. */
  tabs: TabsProps["items"];
  /** The calendar, which fills the rest of the page. */
  children: React.ReactNode;
}

/** The period in words, beside the title. */
const subtitleOf = (view: MeetingsView, date: DateTime): string => {
  if (view === "day") return date.toFormat("cccc, d LLLL yyyy");
  if (view === "month") return date.toFormat("LLLL yyyy");
  const { from, to } = periodOf("week", date);
  const sunday = to.minus({ days: 1 });
  return `Week ${from.weekNumber} · ${from.toFormat(
    from.month === sunday.month ? "d" : "d LLL",
  )} – ${sunday.toFormat("d LLL yyyy")}`;
};

/** Minerva / Meetings / the year, month, week or day. */
const MeetingsBreadcrumbs: React.FunctionComponent<{
  view: MeetingsView;
  date: DateTime;
}> = ({ view, date }) => {
  const crumb = (icon: React.ReactNode, label: string, href?: string) => {
    const title = (
      <Space size={4}>
        {icon}
        <span>{label}</span>
      </Space>
    );
    return { title: href ? <Link href={href}>{title}</Link> : title };
  };
  const items = [
    crumb(<RadarChartOutlined />, "Minerva", "/minerva"),
    crumb(<TeamOutlined />, "Meetings", "/minerva/meetings"),
  ];
  if (view === "week") {
    items.push(crumb(<CalendarOutlined />, `Week ${date.toFormat("WW")}`));
  } else {
    items.push(
      crumb(
        <CalendarOutlined />,
        date.toFormat("LLLL yyyy"),
        view === "day" ? meetingsHref("month", date) : undefined,
      ),
    );
    if (view === "day") {
      items.push(crumb(<CalendarOutlined />, date.toFormat("d")));
    }
  }
  return <OlympusBreadcrumbs className={"dark"} items={items} />;
};

/** The period in numbers, a row of statistics in Dionysus's style. */
const MeetingsSummary: React.FunctionComponent<{
  view: MeetingsView;
  date: DateTime;
  items?: Meeting[];
}> = ({ view, date, items }) => {
  const statistics = useMemo(() => {
    const { from, to } = periodOf(view, date);
    return periodStatistics(items ?? [], from, to);
  }, [view, date, items]);
  const loading = items === undefined;
  const cells: [string, React.ReactNode][] = [
    ["Meetings", statistics.meetings],
    ["In meetings", formatMinutes(statistics.minutes)],
    ["Busy", statistics.byStatus.Busy ?? 0],
    ["Tentative", statistics.byStatus.Tentative ?? 0],
    ["Free", statistics.byStatus.Free ?? 0],
    ["Cancelled", statistics.cancelled],
  ];
  return (
    <Row
      style={{
        borderTop: "1px solid #f0f0f0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      {cells.map(([title, value]) => (
        <Col key={title} span={3} style={CELL}>
          <Statistic title={title} value={value as never} loading={loading} />
        </Col>
      ))}
    </Row>
  );
};

/**
 * A meetings page (Day, Week or Month) laid out as the rest of Minerva is:
 * dark breadcrumbs, the title over the period's numbers, a grey bar of
 * small controls, and the calendar beneath them, with a side panel of
 * icon tabs at the right as Notes and Dionysus have.
 */
const MeetingsPage: React.FunctionComponent<MeetingsPageProps> = ({
  view,
  date,
  items,
  tabs,
  children,
}) => {
  const router = useRouter();
  const go = (target: DateTime, to: MeetingsView = view) =>
    void router.push(meetingsHref(to, target));
  const today = DateTime.now().startOf("day");

  return (
    <>
      <MeetingsBreadcrumbs view={view} date={date} />
      <CollapsibleTabPanel
        panelId={"minerva.meetings.side"}
        width={400}
        tabs={tabs}
      >
        <Flex vertical={true} style={{ height: PAGE_HEIGHT, minHeight: 0 }}>
          <Flex
            justify={"space-between"}
            align={"center"}
            style={{ padding: 16 }}
          >
            <Space align={"baseline"} size={12}>
              <Title level={3} style={{ margin: 0 }}>
                Meetings
              </Title>
              <Text type={"secondary"} style={{ fontSize: 15 }}>
                {subtitleOf(view, date)}
              </Text>
            </Space>
            <Link href={CALENDARS_PATH}>
              <Button type={"text"} icon={<SettingOutlined />}>
                Calendars
              </Button>
            </Link>
          </Flex>
          <MeetingsSummary view={view} date={date} items={items} />
          <Space
            orientation={"horizontal"}
            size={8}
            style={{
              backgroundColor: "#efefef",
              width: "100%",
              boxSizing: "border-box",
              justifyContent: "space-between",
              padding: "8px 16px 8px 8px",
            }}
          >
            <Space size={4}>
              <Button
                size={"small"}
                disabled={periodOf(view, today).from.equals(
                  periodOf(view, date).from,
                )}
                onClick={() => go(today)}
              >
                Today
              </Button>
              <Button
                size={"small"}
                type={"text"}
                icon={<LeftOutlined />}
                aria-label={`The ${view} before`}
                onClick={() => go(stepPeriod(view, date, -1))}
              />
              <Button
                size={"small"}
                type={"text"}
                icon={<RightOutlined />}
                aria-label={`The ${view} after`}
                onClick={() => go(stepPeriod(view, date, 1))}
              />
            </Space>
            <Radio.Group
              size={"small"}
              optionType={"button"}
              buttonStyle={"solid"}
              value={view}
              onChange={(e) => go(date, e.target.value as MeetingsView)}
              aria-label={"View"}
              options={(["day", "week", "month"] as const).map((v) => ({
                value: v,
                label: VIEW_LABEL[v],
              }))}
            />
          </Space>
          <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
        </Flex>
      </CollapsibleTabPanel>
    </>
  );
};

export default MeetingsPage;
