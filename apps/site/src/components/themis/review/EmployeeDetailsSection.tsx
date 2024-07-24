import { Col, Row, Tag, Typography } from "antd";
import { DateTime } from "luxon";
import type {
  BasicUserInfo,
  JobInfo,
  ReviewRating,
} from "../../../types/themis";
import Badge from "../Badge";
import RatingForm from "../form/RatingForm";
import GrowthPotential from "../rating/GrowthPotential";
import Overall from "../rating/Overall";
import { DoubleRightOutlined } from "@ant-design/icons";
import React, { useState } from "react";
import humanizeDuration from "humanize-duration";
import Performance from "../rating/Performance";
import SectionHeading from "./SectionHeading";

export interface EmployeeDetailsSectionProps {
  userInfo: BasicUserInfo;
  jobInfo: JobInfo;
  year: string;
  history: any;
  rating: any;
  updateRating: (data: any) => void;
}

const EmployeeDetailsSection: React.FunctionComponent<
  EmployeeDetailsSectionProps
> = ({ userInfo, jobInfo, year, history, rating, updateRating }) => {
  const [editingRating, setEditingRating] = useState(false);

  return (
    <Row>
      <Col span={20}>
        <Row>
          <Col span={9}>
            <Typography.Text strong={true}>Employee ID:</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong={true}>Department:</Typography.Text>
          </Col>
          <Col span={6}>
            <Typography.Text strong={true}>Coaching Plan:</Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginBottom: 12 }}>
          <Col span={9}>{jobInfo.employeeId}</Col>
          <Col span={9}>{jobInfo.departmentName}</Col>
          <Col span={6}>
            {jobInfo.isUnderPerformanceCoaching ? (
              <Tag style={{ minWidth: 200 }} color={"#aa2222"}>
                Active
              </Tag>
            ) : (
              <Tag style={{ minWidth: 200 }} color={"#33aa33"}>
                None
              </Tag>
            )}
          </Col>
        </Row>
        <Row>
          <Col span={9}>
            <Typography.Text strong={true}>Title:</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong={true}>Department ID:</Typography.Text>
          </Col>
          <Col span={6}>
            <Typography.Text strong={true}>Pivot:</Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginBottom: 12 }}>
          <Col span={9}>{jobInfo.title}</Col>
          <Col span={9}>{jobInfo.departmentId}</Col>
          <Col span={6}>
            {jobInfo.isInPivot ? (
              <Tag
                style={{ minWidth: 200 }}
                color={jobInfo.isNotifiedOfPivot ? "#aa2222" : "#ff5500"}
              >
                Yes -{" "}
                {jobInfo.isNotifiedOfPivot
                  ? "Employee Informed"
                  : "Employee Not Informed"}
              </Tag>
            ) : (
              <Tag style={{ minWidth: 200 }} color={"#33aa33"}>
                No
              </Tag>
            )}
          </Col>
        </Row>
        <Row>
          <Col span={9}>
            <Typography.Text strong={true}>Job Title</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong={true}>Is Manager:</Typography.Text>
          </Col>
          <Col span={6}>
            <Typography.Text strong={true}>Promotion:</Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginBottom: 12 }}>
          <Col span={9}>{jobInfo.jobTitle}</Col>
          <Col span={9}>{jobInfo.isManager ? "Yes" : "No"}</Col>
          <Col span={6}>
            {jobInfo.promotionYear || jobInfo.promotionQuarter ? (
              <Tag style={{ minWidth: 200 }} color={"#33aa33"}>
                Scheduled - Q{jobInfo.promotionQuarter} {jobInfo.promotionYear}
              </Tag>
            ) : (
              <Tag style={{ minWidth: 200 }} color={"#999"}>
                Not Scheduled
              </Tag>
            )}
          </Col>
        </Row>
        <Row>
          <Col span={9}>
            <Typography.Text strong={true} style={{ textAlign: "right" }}>
              Level
            </Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginBottom: 32 }}>
          <Col span={9}>{jobInfo.level}</Col>
        </Row>
        <Row>
          <Col span={9}>
            <Typography.Text strong={true}>First Hire Date:</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong={true}>Last Hire Date:</Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginBottom: 12 }}>
          <Col span={9}>
            {DateTime.fromISO(history.firstHireDate).toFormat("yyyy-MM-dd")}
          </Col>
          <Col span={9}>
            {DateTime.fromISO(history.lastHireDate).toFormat("yyyy-MM-dd")}
          </Col>
        </Row>
        <Row>
          <Col span={9}>
            <Typography.Text strong={true}>Total Tenure:</Typography.Text>
          </Col>
          <Col span={9}>
            <Typography.Text strong={true}>FTE Tenure:</Typography.Text>
          </Col>
        </Row>
        <Row style={{ marginBottom: 16 }}>
          <Col span={9}>
            {humanizeDuration(history.tenure, {
              unitMeasures: {
                y: 365,
                mo: 30,
                w: 7,
                d: 1,
              },
              units: ["y", "mo", "d"],
            })}
          </Col>
          <Col span={9}>
            {humanizeDuration(history.fteTenure, {
              unitMeasures: {
                y: 365,
                mo: 30,
                w: 7,
                d: 1,
              },
              units: ["y", "mo", "d"],
            })}
          </Col>
        </Row>
        <SectionHeading
          title={"Performance"}
          onEdit={() => {
            setEditingRating(true);
          }}
          editing={editingRating}
        >
          {editingRating ? (
            <RatingForm
              username={userInfo.username}
              year={year}
              onUpdateSuccess={async (data: ReviewRating) => {
                updateRating(data);
                setEditingRating(false);
              }}
              onCancel={() => {
                setEditingRating(false);
              }}
              existingRating={rating}
            />
          ) : (
            <>
              <Row>
                <Col
                  span={6}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Typography.Text
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Performance
                  </Typography.Text>
                </Col>
                <Col span={1} />
                <Col span={6}>
                  <Typography.Text
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Growth Potential
                  </Typography.Text>
                </Col>
                <Col span={4}></Col>
                <Col span={6}>
                  <Typography.Text
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Overall
                  </Typography.Text>
                </Col>
              </Row>
              <Row>
                <Col span={6}>
                  <Performance rating={rating.performance} size={"small"} />
                </Col>
                <Col span={1} />
                <Col span={6}>
                  <GrowthPotential rating={rating.growth} size={"small"} />
                </Col>
                <Col
                  span={4}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <DoubleRightOutlined
                    style={{ fontSize: 18, fontWeight: "bold" }}
                  />
                </Col>
                <Col span={6}>
                  <Overall rating={rating.overall} size={"small"} />
                </Col>
              </Row>
            </>
          )}
        </SectionHeading>
      </Col>
      <Col span={4} style={{ display: "flex", alignItems: "start" }}>
        <Badge
          username={userInfo.username}
          name={userInfo.givenName}
          tenure={history.fteTenure}
        />
      </Col>
    </Row>
  );
};

export default EmployeeDetailsSection;
