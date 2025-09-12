import { CalendarOutlined } from "@ant-design/icons";
import type { IconProps } from "@ant-design/icons/es/components/IconBase";
import { Col, Popover, Row, Space, Typography } from "antd";
import { DateTime } from "luxon";

export interface TimestampProps {
  value: string;
  unknownValue?: string;
  showTime?: boolean;
  showIcon?: boolean;
  icon?: React.ReactNode;
  direction?: "vertical" | "horizontal";
}

const Timestamp: React.FunctionComponent<TimestampProps> = ({
  value,
  unknownValue = "--",
  showTime = false,
  showIcon = true,
  icon = <CalendarOutlined />,
  direction = "vertical",
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
          {showIcon && icon}
          <Space
            direction={direction}
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
                {direction === "horizontal" && "\u00A0"}
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
