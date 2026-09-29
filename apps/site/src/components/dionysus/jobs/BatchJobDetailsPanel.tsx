import { Col, Empty, Row, Space, Typography } from "antd";
import Description from "../../common/Description";
import Timestamp from "../../data/Timestamp";
import { type BatchJob } from "@ncfritz/olympus-sdk/dionysus";

import { getBatchJobStatusIndicator } from "./utils";

export interface BatchJobDetailsPanelProps {
  job: BatchJob;
  close: () => void;
}

const BatchJobDetailsPanel: React.FunctionComponent<
  BatchJobDetailsPanelProps
> = ({ job }: BatchJobDetailsPanelProps) => {
  if (!job) {
    return <Empty description={"No Batch Job Found"} />;
  }

  return (
    <Space style={{ width: "100%" }} orientation={"vertical"} size={8}>
      <Row>
        <Col span={24}>
          <Typography.Title level={4}>Job Details</Typography.Title>
        </Col>
        <Col span={24}>
          <Description
            title={"ID"}
            value={job.id}
            valueStyle={{ fontSize: "inherit" }}
          />
        </Col>
        <Col span={24}>
          <Col span={12}>
            <Description
              title={"status"}
              value={getBatchJobStatusIndicator(job.status)}
              valueStyle={{ fontSize: "inherit" }}
            />
          </Col>
        </Col>
        <Col span={24} style={{ marginTop: 24 }}>
          <Typography.Title level={4}>Job Timing</Typography.Title>
        </Col>
        <Col span={12}>
          <Description
            title={"Created Time"}
            value={<Timestamp value={job.createdTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Last Updated Time"}
            value={<Timestamp value={job.lastUpdatedTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Started Time"}
            value={<Timestamp value={job.startedTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Finished Time"}
            value={<Timestamp value={job.finishedTime} showTime={true} />}
            valueStyle={{ fontSize: "inherit" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={24} style={{ marginTop: 24 }}>
          <Typography.Title level={4}>Records</Typography.Title>
        </Col>
        <Col span={12}>
          <Description
            title={"Total Records"}
            value={job.totalRecords?.toLocaleString()}
            valueStyle={{ fontFamily: "monospace" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Processed Records"}
            value={job.processedRecords?.toLocaleString()}
            valueStyle={{ fontFamily: "monospace" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Duplicate Records"}
            value={job.duplicateRecords?.toLocaleString()}
            valueStyle={{ fontFamily: "monospace" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"New Records"}
            value={job.newRecords?.toLocaleString()}
            valueStyle={{ fontFamily: "monospace" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"Expired Records"}
            value={job.expiredRecords?.toLocaleString()}
            valueStyle={{ fontFamily: "monospace" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={12}>
          <Description
            title={"No-op Records"}
            value={job.noOpRecords?.toLocaleString()}
            valueStyle={{ fontFamily: "monospace" }}
            titleColor={"#666666"}
            titleFontSize={"13px"}
          />
        </Col>
        <Col span={24}></Col>
      </Row>
    </Space>
  );
};
export default BatchJobDetailsPanel;
