import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import HC_more from "highcharts/highcharts-more";
import xrange from "highcharts/modules/xrange";
import { Col, Empty, Row, Typography } from "antd";
import { DateTime } from "luxon";
import type { JobHistoryEntry } from "../../../types/themis";

const getColor = (level: string, fte: boolean) => {
  if (fte) {
    switch (level) {
      case "4":
        return "#b8e1eb";
      case "5":
        return "#66c9e1";
      case "6":
        return "#1aadd1";
      case "7":
        return "#086e87";
      case "8":
        return "#002933";
    }
  } else {
    switch (level) {
      case "3":
      case "99":
        return "#fff7b7";
      case "4":
        return "#ffec53";
      case "5":
        return "#eed400";
      case "6":
        return "#8a7b00";
    }

    return "#b5f390";
  }

  return "#ff8080";
};

interface LevelProps {
  level: string;
  fte: boolean;
  invert?: boolean;
}

const Level: React.FunctionComponent<LevelProps> = ({
  level,
  fte,
  invert = false,
}) => {
  return (
    <Col
      span={1}
      style={{ display: "flex", justifyContent: "center", padding: 3 }}
    >
      <Typography.Text
        style={{
          backgroundColor: getColor(level, fte),
          color: invert ? "#ffffff" : "#000000",
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 5,
          fontSize: 13,
        }}
      >
        {level}
      </Typography.Text>
    </Col>
  );
};

export interface JobHistoryGraphProps {
  data: JobHistoryEntry[];
}

const JobHistoryGraph: React.FunctionComponent<JobHistoryGraphProps> = ({
  data,
}) => {
  HC_more(Highcharts);
  xrange(Highcharts);

  const categories: string[] = [];

  data.forEach((entry) => {
    if (categories.indexOf(entry.jobTitle) === -1) {
      categories.push(entry.jobTitle);
    }
  });

  const seriesData: any[] = [];
  data.forEach((entry) => {
    seriesData.push({
      x: DateTime.fromISO(entry.start).toMillis(),
      x2: DateTime.fromISO(entry.end!).toMillis(),
      y: categories.indexOf(entry.jobTitle),
      color: getColor(entry.level.toString(), entry.fte),
    });
  });

  const options = {
    chart: {
      type: "xrange",
      height: categories.length * 30 + 100,
    },
    plotOptions: {
      series: {
        animation: false,
      },
    },
    title: {
      text: null,
    },
    xAxis: {
      type: "datetime",
    },
    yAxis: {
      lineWidth: 1,
      tickInterval: 1,
      min: 0,
      categories: categories,
      title: {
        text: null,
      },
    },
    legend: {
      enabled: false,
    },
    credits: {
      enabled: false,
    },
    series: [
      {
        name: "history",
        pointWidth: 20,
        data: seriesData,
      },
    ],
  };

  if (seriesData.length > 0) {
    return (
      <>
        <Row>
          <Col span={24}>
            <HighchartsReact highcharts={Highcharts} options={options} />
          </Col>
        </Row>
        <Row>
          <Col offset={16} span={2} />
          <Col
            span={5}
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Level
          </Col>
        </Row>
        <Row style={{ display: "flex", alignItems: "center" }}>
          <Col
            offset={16}
            span={2}
            style={{
              display: "flex",
              justifyContent: "end",
              marginRight: 8,
              fontSize: 13,
            }}
          >
            Blue Badge
          </Col>
          <Level level={"4"} fte={true} />
          <Level level={"5"} fte={true} />
          <Level level={"6"} fte={true} invert={true} />
          <Level level={"7"} fte={true} invert={true} />
          <Level level={"8"} fte={true} invert={true} />
        </Row>
        <Row style={{ display: "flex", alignItems: "center" }}>
          <Col
            offset={16}
            span={2}
            style={{
              display: "flex",
              justifyContent: "end",
              marginRight: 8,
              fontSize: 13,
            }}
          >
            Yellow Badge
          </Col>
          <Level level={"99"} fte={false} />
          <Level level={"3"} fte={false} />
          <Level level={"4"} fte={false} />
          <Level level={"5"} fte={false} />
          <Level level={"6"} fte={false} invert={true} />
        </Row>
      </>
    );
  } else {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={"No job history data available"}
      ></Empty>
    );
  }
};

export default JobHistoryGraph;
