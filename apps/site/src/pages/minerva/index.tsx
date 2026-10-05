import {
  CalendarOutlined,
  FilterOutlined,
  HomeOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import { Collapse, Space } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import meetingsApi from "../../api/meetingsApi";
import CollapsibleTabPanel from "../../components/layout/CollapsibleTabPanel";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import GoalsPanel from "../../components/minerva/home/GoalsPanel";
import styles from "../../components/minerva/home/MinervaHome.module.css";
import MeetingsFilterPanel from "../../components/minerva/meetings/availability/MeetingsFilterPanel";
import NotesEditorForm, {
  NEW_NOTE,
  type NotesFormInput,
} from "../../components/notes/NotesEditorForm";
import useAvailabilityCalendar from "../../hooks/useAvailabilityCalendar";

/** Today's calendar, as wide as it was beside the goals. */
const CALENDAR_WIDTH = 600;
/** The side panel open: its border, the calendar and the tab strip. */
const SIDE_PANEL_WIDTH = 1 + CALENDAR_WIDTH + 62;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();

  const rootRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);
  // FullCalendar measures itself on window resizes only; the side panel
  // opening, closing or first showing its tab changes its box without one.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      calendarRef.current?.getApi().updateSize(),
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: NEW_NOTE,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const startDate = useMemo(() => DateTime.now().startOf("day"), []);

  useEffect(() => {
    (async () => {
      const rawEvents = await meetingsApi.getMeetings(startDate, 1);
      setMeetings(rawEvents.data.items);
    })();
  }, []);

  const calendar = useAvailabilityCalendar({
    meetings,
    start: startDate.toJSDate(),
    end: startDate.plus({ days: 1 }).toJSDate(),
    onMeetingClick: async (arg) => {
      const target = `/minerva/meetings/${startDate.year}/${startDate.toFormat("MM")}/${startDate.toFormat("dd")}?e=${encodeURIComponent(arg.event.id)}`;
      await router.push(target, target, { shallow: true });
    },
  });

  const sideTabs = [
    {
      key: "t-calendar",
      label: <CalendarOutlined />,
      children: (
        <div ref={rootRef} className={styles.calendar}>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, listPlugin, interactionPlugin]}
            viewClassNames={"minerva-cal minerva-cal-home hide-day-header"}
            initialDate={startDate.toJSDate()}
            events={calendar.events}
            eventContent={calendar.eventContent}
            eventClick={calendar.eventClick}
            selectable={true}
            selectMirror={true}
            select={calendar.select}
            selectAllow={calendar.selectAllow}
            eventChange={calendar.eventChange}
            initialView="timeGridDay"
            height={"100%"}
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "9:00",
              endTime: "17:00",
            }}
            headerToolbar={{
              start: "title",
              center: "",
              end: "",
            }}
            titleFormat={{
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            }}
            nowIndicator={true}
            slotDuration={{ minutes: 15 }}
          />
        </div>
      ),
    },
    {
      key: "t-filters",
      label: <FilterOutlined />,
      children: <MeetingsFilterPanel />,
    },
  ];

  return (
    <>
      <OlympusBreadcrumbs
        className={"dark"}
        items={[
          {
            title: (
              <Link href={"/"}>
                <Space size={4}>
                  <HomeOutlined />
                  <span>Home</span>
                </Space>
              </Link>
            ),
          },
          {
            title: (
              <Space size={4}>
                <RadarChartOutlined />
                <span>Minerva</span>
              </Space>
            ),
          },
        ]}
      />
      <CollapsibleTabPanel
        panelId={"minerva.home.side"}
        width={SIDE_PANEL_WIDTH}
        tabs={sideTabs}
        defaultExpanded={true}
        // The calendar runs up to the tab strip; AntD sets tabs on the right
        // 24px in from it.
        tabContentStyle={{ paddingInlineEnd: 0 }}
        style={{
          width: "100%",
        }}
      >
        <div className={styles.main}>
          <div className={styles.goals}>
            <GoalsPanel />
          </div>
          <Collapse
            ghost={true}
            items={[
              {
                key: "minerva-notes-editor",
                label: "Add note",
                children: (
                  <NotesEditorForm
                    onClose={close}
                    showTitle={false}
                    showSummary={false}
                    formControl={{
                      control: control,
                      reset: reset,
                      handleSubmit: handleSubmit,
                    }}
                  />
                ),
              },
            ]}
          />
        </div>
      </CollapsibleTabPanel>
    </>
  );
};

export default IndexPage;
