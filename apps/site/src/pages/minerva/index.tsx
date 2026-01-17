import { HomeOutlined, RadarChartOutlined } from "@ant-design/icons";
import type { EventInput } from "@fullcalendar/core";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Col, Collapse, Layout, Space } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import meetingsApi from "../../api/meetingsApi";
import OlympusBreadcrumbs from "../../components/layout/OlympusBreadcrumbs";
import NotesEditorForm, {
  NEW_NOTE,
  type NotesFormInput,
} from "../../components/notes/NotesEditorForm";

const { Sider, Content } = Layout;

const IndexPage: React.FunctionComponent = () => {
  const router = useRouter();

  const calendarRef = useRef<FullCalendar>(null);

  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: NEW_NOTE,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const [events, setEvents] = useState<EventInput[]>([]);

  const startDate = DateTime.now().startOf("day");

  useEffect(() => {
    (async () => {
      const rawEvents = await meetingsApi.getMeetings(startDate, 1);
      const parsedEvents: EventInput[] = [];

      rawEvents.data.items.forEach((rawEvent: any) => {
        const event = meetingsApi.toEvent(rawEvent);

        parsedEvents.push(event);
      });

      setEvents(parsedEvents);
    })();
  }, []);

  return (
    <Space>
      <OlympusBreadcrumbs
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
      <Layout
        style={{
          position: "fixed",
          background: "#ffffff",
          gap: 16,
          top: 102,
          marginRight: 788,
          overflowX: "hidden",
          overflowY: "auto",
          height: "calc(100vh - 202px)",
        }}
      >
        <Content style={{ width: "calc(100vw - 993px)" }}>
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
        </Content>
        <Sider
          width={600}
          collapsible={false}
          style={{
            background: "#ffffff",
            top: 102,
            right: 0,
            position: "fixed",
            height: "calc(100vh - 104px)",
            borderLeft: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Col style={{ height: "calc(100vh - 102px)", width: 600 }}>
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, listPlugin]}
              viewClassNames={"minerva-cal minerva-cal-home hide-day-header"}
              initialDate={startDate.toJSDate()}
              events={events}
              initialView="timeGridDay"
              height={"100%"}
              businessHours={{
                days: [1, 2, 3, 4, 5],
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
              eventClick={async (arg) => {
                const target = `/minerva/meetings/${startDate.year}/${startDate.toFormat("MM")}/${startDate.toFormat("dd")}?e=${encodeURIComponent(arg.event.id)}`;
                await router.push(target, target, { shallow: true });
              }}
            />
          </Col>
        </Sider>
      </Layout>
    </Space>
  );
};

export default IndexPage;
