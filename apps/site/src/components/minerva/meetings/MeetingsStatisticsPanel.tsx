import { Alert, Button, Space, Spin } from "antd";
import { type DateTime } from "luxon";
import React, { useCallback, useEffect, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import { Events, publish } from "../../../utils/events";
import MeetingsDayOfWeekGraph from "./MeetingsDayOfWeekGraph";
import MeetingsHourOfDayGraph from "./MeetingsHourOfDayGraph";

export interface MeetingStatisticsPanelProps {
  startDate: DateTime;
  dayCount: number;
}

const MeetingStatisticsPanel: React.FunctionComponent<
  MeetingStatisticsPanelProps
> = ({ startDate, dayCount }) => {
  const [statistics, setStatistics] = useState<any>(undefined);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsError, setStatisticsError] = useState(false);

  const loadStatistics = useCallback(async () => {
    setStatisticsLoading(true);

    try {
      setStatisticsError(false);
      const summaryResponse = await meetingsApi.getStatistics(
        startDate,
        dayCount,
      );
      setStatistics(summaryResponse.data);
    } catch {
      const endDate = startDate.plus({ days: dayCount });
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Failed to load meeting summary",
        description: `Unable fetch meeting summary for range ${startDate.toISODate()} to ${endDate.toISODate()}`,
      });
      setStatisticsError(true);
    } finally {
      setStatisticsLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    (async () => {
      await loadStatistics();
    })();
  }, [startDate]);

  let content;

  if (statisticsLoading) {
    content = <Spin></Spin>;
  } else if (statisticsError) {
    content = (
      <Alert
        type={"error"}
        message={"Error"}
        description={"Unable to load meeting statistics"}
        showIcon={true}
        action={
          <Button
            size={"small"}
            danger={true}
            onClick={async () => {
              await loadStatistics();
            }}
          >
            Retry
          </Button>
        }
      />
    );
  } else {
    content = (
      <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
        <MeetingsHourOfDayGraph
          date={startDate}
          summaryLoading={statisticsLoading}
          summary={statistics}
          width={400}
        />
        <MeetingsDayOfWeekGraph
          date={startDate}
          summaryLoading={statisticsLoading}
          summary={statistics}
          width={400}
        />
      </Space>
    );
  }

  return content;
};
export default MeetingStatisticsPanel;
