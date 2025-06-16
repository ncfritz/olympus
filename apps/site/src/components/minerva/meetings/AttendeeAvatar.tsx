import { Avatar, Popover, Space, Typography } from "antd";
import React from "react";

export interface AttendeeAvatarProps {
  attendee: any;
}

const AttendeeAvatar: React.FunctionComponent<AttendeeAvatarProps> = ({
  attendee,
}: AttendeeAvatarProps) => {
  let avatarSrc = `https://cdn.internal.ncfritz.net/amzn/avatar/${attendee.alias}.jpg`;

  if (attendee.type === "PublicDL") {
    avatarSrc = "/assets/images/avatar/exchdl.png";
  } else if (attendee.type === "OneOff") {
    if (attendee.email.endsWith("chime.aws")) {
      avatarSrc = "/assets/images/avatar/chime.png";
    }
  }

  const popoverContent = (
    <Space direction={"vertical"} size={0}>
      <Space direction={"horizontal"} style={{ marginBottom: 8 }}>
        <AttendeeAvatar attendee={attendee} />
        <Space direction={"vertical"} size={0}>
          <Typography.Title level={5} style={{ paddingBottom: 4, margin: 0 }}>
            {`${attendee.givenName} ${attendee.surname}`}
          </Typography.Title>
          <Typography.Text>{attendee.email}</Typography.Text>
        </Space>
      </Space>
      <Space direction={"horizontal"}>
        <Typography.Text strong={true}>Attendance:</Typography.Text>
        {attendee.attendance}
      </Space>
      <Space direction={"horizontal"}>
        <Typography.Text strong={true}>Response</Typography.Text>
        {attendee.response}
      </Space>
    </Space>
  );

  return (
    <Popover content={popoverContent} placement={"top"}>
      <Avatar shape={"circle"} size={"large"} src={avatarSrc} />
    </Popover>
  );
};
export default AttendeeAvatar;
