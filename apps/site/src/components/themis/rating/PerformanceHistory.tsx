import { CheckCircleFilled } from "@ant-design/icons";
import { Col, Empty, Row, Typography } from "antd";
import type {ReviewRating} from "../../../types/themis";
import {
  overallRatingColors,
  performanceRatingColors,
  potentialColors,
} from "./constants";
import PerformanceHistoryIndicator from "./PerformanceHistoryIndicator";

export interface PerformanceHistoryProps {
  data: ReviewRating[];
}

const PerformanceHistory: React.FunctionComponent<PerformanceHistoryProps> = ({
  data,
}) => {
  if (data && data.length > 0) {
    const rows: any[] = [];

    data.forEach((entry: any) => {
      rows.push(
        <Row>
          <Col span={2} />
          <Col
            span={3}
            className={"p5 b-r1"}
            style={{
              justifyContent: "end",
              display: "flex",
              alignItems: "center",
            }}
          >
            {entry.year} - Q{entry.quarter}
          </Col>
          <Col
            span={1}
            className={"p5 b-r1"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
            }}
          >
            {entry.focal ? <CheckCircleFilled /> : ""}
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["NI1"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["NI2"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["NI3"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["M1"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["M2"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["E1"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5 b-r1"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.performance}
              colors={performanceRatingColors}
              allowedRatings={["E2"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.growth}
              colors={potentialColors}
              allowedRatings={["L"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.growth}
              colors={potentialColors}
              allowedRatings={["M"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.growth}
              colors={potentialColors}
              allowedRatings={["H"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5 b-r1"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.growth}
              colors={potentialColors}
              allowedRatings={["VH"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.overall}
              colors={overallRatingColors}
              allowedRatings={["LE"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.overall}
              colors={overallRatingColors}
              allowedRatings={["HV1"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.overall}
              colors={overallRatingColors}
              allowedRatings={["HV2"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.overall}
              colors={overallRatingColors}
              allowedRatings={["HV3"]}
            />
          </Col>
          <Col
            span={1}
            className={"p5"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PerformanceHistoryIndicator
              rating={entry.overall}
              colors={overallRatingColors}
              allowedRatings={["TT"]}
            />
          </Col>
          <Col span={1} style={{ textAlign: "center" }}></Col>
        </Row>,
      );
    });

    return (
      <>
        <Row>
          <Col span={2} />
          <Col span={3} className={"b-r1"}></Col>
          <Col span={1} className={"b-r1"}></Col>
          <Col
            span={7}
            className={"b-b1 b-r1 p5"}
            style={{ textAlign: "center" }}
          >
            <Typography.Text strong={true}>Performance</Typography.Text>
          </Col>
          <Col
            span={4}
            className={"b-b1 b-r1 p5"}
            style={{ textAlign: "center" }}
          >
            <Typography.Text strong={true}>Growth</Typography.Text>
          </Col>
          <Col span={5} className={"b-b1 p5"} style={{ textAlign: "center" }}>
            <Typography.Text strong={true}>Overall</Typography.Text>
          </Col>
        </Row>
        <Row>
          <Col span={2} />
          <Col span={3} className={"b-r1"}></Col>
          <Col span={1} className={"b-r1"}></Col>
          <Col span={3} className={"b-r1 p5"} style={{ textAlign: "center" }}>
            Lowers
          </Col>
          <Col span={2} className={"b-r1 p5"} style={{ textAlign: "center" }}>
            Meets
          </Col>
          <Col span={2} className={"b-r1 p5"} style={{ textAlign: "center" }}>
            Exceeds
          </Col>
          <Col span={4} className={"b-r1"}></Col>
        </Row>
        <Row>
          <Col span={2} />
          <Col
            span={3}
            className={"b-b1 b-r1 p5"}
            style={{
              justifyContent: "right",
              display: "flex",
              alignItems: "end",
            }}
          >
            Year
          </Col>
          <Col span={1} className={"b-b1 b-r1 p5 vtext"}>
            Focal
          </Col>
          <Col
            span={1}
            className={"b-b1 p5"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            1
          </Col>
          <Col
            span={1}
            className={"b-b1 p5"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            2
          </Col>
          <Col
            span={1}
            className={"b-b1 b-r1 p5"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            3
          </Col>
          <Col
            span={1}
            className={"b-b1 p5"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            4
          </Col>
          <Col
            span={1}
            className={"b-b1 b-r1 p5"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            5
          </Col>
          <Col
            span={1}
            className={"b-b1 p5"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            6
          </Col>
          <Col
            span={1}
            className={"b-b1 p5 b-r1"}
            style={{
              justifyContent: "center",
              display: "flex",
              alignItems: "end",
            }}
          >
            7
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            Low
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            Medium
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            High
          </Col>
          <Col span={1} className={"b-b1 b-r1 p5 vtext"}>
            Very High
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            LE
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            HV1
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            HV2
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            HV3
          </Col>
          <Col span={1} className={"b-b1 p5 vtext"}>
            TT
          </Col>
        </Row>
        {rows}
      </>
    );
  } else {
    return (
      <Empty
        description={
          <Typography.Text italic={true}>
            No past performance data
          </Typography.Text>
        }
      />
    );
  }
};
export default PerformanceHistory;
