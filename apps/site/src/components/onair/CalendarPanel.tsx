import { EventImpl } from "@fullcalendar/core/internal";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Spin } from "antd";
import { v4 as uuidv4 } from "uuid";
import OnAirEvent from "./OnAirEvent";
import OnAirOverrideEvent from "./OnAirOverrideEvent";

export interface CalendarPanelProps {
  loading: boolean;
  events: any[];
  rangeStart: any;
  rangeEnd: any;
  setTargetEvent: (e: EventImpl) => void;
  updateOverride: (
    id: string,
    status: string,
    start: Date,
    end: Date,
  ) => Promise<void>;
  removeOverride: (id: string) => Promise<void>;
  fetchEvents: () => Promise<void>;
  updateEventStatus: (id: string, status: string) => Promise<void>;
}

const CalendarPanel: React.FunctionComponent<CalendarPanelProps> = ({
  loading,
  events,
  rangeStart,
  rangeEnd,
  setTargetEvent,
  updateOverride,
  removeOverride,
  updateEventStatus,
  fetchEvents,
}: CalendarPanelProps) => {
  let content = <Spin size={"large"} />;

  if (!loading) {
    content = (
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridDay"
        editable={true}
        selectable={true}
        height={"100%"}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "8:00",
          endTime: "18:00",
        }}
        headerToolbar={{
          left: "prev,today,next",
          center: "title",
          right: "",
        }}
        allDaySlot={false}
        slotDuration={{ minutes: 15 }}
        slotLabelInterval={{ hour: 1 }}
        validRange={(date) => {
          return {
            start: rangeStart,
            end: rangeEnd,
          };
        }}
        events={events}
        eventMinHeight={20}
        eventBackgroundColor={"#ffffff"}
        eventClassNames={(e) => {
          const baseClass = "oa-event";
          const classes = [baseClass];

          if (e.event.display === "background") {
            // No additional classes for now
          } else if (e.event.extendedProps.type === "Override") {
            if (e.event.extendedProps.status !== undefined) {
              classes.push(
                `oa-override-${e.event.extendedProps.status.toLowerCase()}`,
              );
            }
          } else {
            classes.push(
              `oa-status-${e.event.extendedProps.status.toLowerCase()}`,
            );
          }

          return classes;
        }}
        select={async (arg) => {
          setTargetEvent({
            id: uuidv4(),
            start: arg.start,
            end: arg.end,
            extendedProps: {
              status: "clear",
              subject: "OVERRIDE",
              type: "Override",
              isNew: true,
            },
          } as unknown as EventImpl);
        }}
        eventChange={async (arg) => {
          await updateOverride(
            arg.event.id,
            arg.event.extendedProps.status,
            arg.event.start!,
            arg.event.end!,
          );
          await fetchEvents();
        }}
        eventOverlap={true}
        eventContent={(e) => {
          if (e.event.extendedProps.type === "Override") {
            return (
              <OnAirOverrideEvent
                event={e.event}
                openFunction={() => {
                  setTargetEvent(e.event);
                }}
                updateFunction={updateOverride}
                removeFunction={removeOverride}
              />
            );
          } else {
            return (
              <OnAirEvent
                event={e.event}
                updateFunction={updateEventStatus}
                openFunction={() => {
                  setTargetEvent(e.event);
                }}
              />
            );
          }
        }}
        nowIndicator={true}
      />
    );
  }

  return content;
};
export default CalendarPanel;
