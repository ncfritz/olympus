import { CalendarOutlined } from "@ant-design/icons";
import { Col, Popover, Row, Space, Typography } from "antd";
import { DateTime } from "luxon";

export interface TimestampProps {
  value: string;
  unknownValue?: string;
  showTime?: boolean;
}

const Timestamp: React.FunctionComponent<TimestampProps> = ({
  value,
  unknownValue = "--",
  showTime = false,
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
          <Space
            direction={"vertical"}
            size={0}
            align={"start"}
            styles={{
              item: {
                lineHeight: "12px",
              },
            }}
          >
            <Typography.Text
              style={{
                fontSize: "12px",
                lineHeight: "12px",
              }}
            >
              {time.toFormat("yyyy-MM-dd")}
            </Typography.Text>
            {showTime && (
              <Typography.Text style={{ fontSize: "11px", lineHeight: "12px" }}>
                {time.toFormat("hh:mm:ss a")}
              </Typography.Text>
            )}
          </Space>
        </Space>
      </Popover>
    );
  }
};
export default Timestamp;
