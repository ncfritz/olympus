import { CalendarOutlined } from "@ant-design/icons";
import { Col, Popover, Row, Space, Typography } from "antd";
import { DateTime } from "luxon";

export interface TimestampProps {
  value: string;
  unknownValue?: string;
}

const Timestamp: React.FunctionComponent<TimestampProps> = ({
  value,
  unknownValue = "--",
}: TimestampProps) => {
  const time = DateTime.fromISO(value).toUTC();

  if (!time || !time.isValid) {
    return <Typography.Text>{unknownValue}</Typography.Text>;
  } else {
    const popoverContent = (
      <>
        <Row gutter={[8, 8]}>
          <Col>
            <Typography.Text strong={true}>UTC:</Typography.Text>
          </Col>
          <Col>
            <Typography.Text>
              {time.toISO({
                suppressMilliseconds: true,
                includeOffset: false,
              })}
            </Typography.Text>
          </Col>
        </Row>
        <Row gutter={[8, 8]}>
          <Col>
            <Typography.Text strong={true}>PST:</Typography.Text>
          </Col>
          <Col>
            <Typography.Text>
              {time
                .setZone("America/Los_Angeles")
                .toISO({ suppressMilliseconds: true, includeOffset: false })}
            </Typography.Text>
          </Col>
        </Row>
      </>
    );

    return (
      <Popover
        content={popoverContent}
        trigger={"hover"}
        style={{ width: 250 }}
        placement={"bottomLeft"}
      >
        <Space direction={"horizontal"} size={8} align={"center"}>
          <CalendarOutlined />
          <Typography.Text>{time.toFormat("yyyy-MM-dd")}</Typography.Text>
        </Space>
      </Popover>
    );
  }
};
export default Timestamp;
