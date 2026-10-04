import type { Meeting } from "@ncfritz/olympus-sdk/minerva";
import { ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Avatar, Button, Space, Spin, Typography } from "antd";
import React, { useEffect, useState } from "react";
import meetingsApi from "../../../api/meetingsApi";
import { organizerOf } from "../../../utils/meetings";
import type { NoteAssociation } from "../../../utils/notes";

export interface AssociatedItemProps {
  open: boolean;
  item: NoteAssociation;
}

const MeetingNoteAssociation: React.FunctionComponent<AssociatedItemProps> = ({
  open,
  item,
}: AssociatedItemProps) => {
  const [meeting, setMeeting] = useState<Meeting | undefined | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(false);
  const [loaingError, setLoadingError] = useState<Error | undefined>(undefined);

  const loadMeeting = async () => {
    setLoadingError(undefined);
    setLoading(true);

    try {
      const meetingResponse = await meetingsApi.getMeeting(item.itemId);
      setMeeting(meetingResponse.data.item);
    } catch (e) {
      setLoadingError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (open && !meeting) {
        loadMeeting();
      }
    })();
  }, [open]);

  let content = <></>;

  if (loading) {
    content = <Spin size={"small"} />;
  } else if (loaingError) {
    content = (
      <Alert
        message={"Unable to load meeting."}
        type={"error"}
        action={
          <Button
            type={"text"}
            size={"small"}
            ghost={true}
            onClick={async () => {
              await loadMeeting();
            }}
            icon={<ReloadOutlined />}
          />
        }
      />
    );
  } else if (!meeting) {
    content = (
      <Alert
        message={"No meeting details found."}
        type={"warning"}
        action={
          <Button
            type={"text"}
            size={"small"}
            ghost={true}
            onClick={async () => {
              await loadMeeting();
            }}
            icon={<ReloadOutlined />}
          />
        }
      />
    );
  } else {
    content = (
      <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
        <Space
          direction={"horizontal"}
          className={`oa-event oa-status-${meeting.status.toLowerCase()} minerva-event`}
          style={{
            width: "calc(100% - 16px)",
            margin: 8,
            position: "relative",
            justifyContent: "space-between",
            borderRadius: 6,
          }}
        >
          <Space size={8} direction={"horizontal"}>
            <img
              src={"/calendar.png"}
              width={20}
              height={20}
              alt={"calendar"}
            />
            <Typography.Text strong={true} style={{ fontSize: "13px" }}>
              {meeting.subject}
            </Typography.Text>
          </Space>
          <Space
            size={8}
            direction={"horizontal"}
            style={{ alignItems: "center" }}
          >
            <Space orientation={"horizontal"}>
              <Typography.Text
                style={{ paddingBottom: 2, margin: 0, fontSize: 13 }}
              >
                {organizerOf(meeting).name}
              </Typography.Text>
              <Avatar
                shape={"circle"}
                size={"small"}
                src={organizerOf(meeting).avatar}
                icon={<UserOutlined />}
              />
            </Space>
          </Space>
        </Space>
      </Space>
    );
  }

  return content;
};
export default MeetingNoteAssociation;
