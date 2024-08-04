import {Col, Empty, Flex, Result, Row, Space, Spin, Typography} from "antd";
import React, {type ReactNode, useEffect, useState} from "react";
import themisApi from "../../../api/themisApi";
import type { Mentee } from "../../../types/themis";
import NoteHtmlDisplay from "../../notes/NoteHtmlDisplay";
import Badge from "../Badge";
import SectionHeading from "./SectionHeading";

export interface MentorshipSectionProps {
  username: string;
  year: string;
}

const MentorshipSection: React.FunctionComponent<MentorshipSectionProps> = ({
  username,
  year,
}: MentorshipSectionProps) => {
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadNotes = async (quite = false) => {
    if (!quite) {
      setLoading(true);
    }

    try {
      setError(false);

      const response = await themisApi.review.getMentorship(username, year);
      setMentees(response.mentorship);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (username && year) {
        await loadNotes();
      }
    })();
  }, [username, year]);

  let content: any;

  if (loading) {
    content = (
      <Space
        direction={"vertical"}
        style={{ width: "100%", padding: 64, textAlign: "center" }}
      >
        <Spin size={"large"} />
      </Space>
    );
  } else if (error) {
    content = <Result status={"error"} title={"Unable to load review notes"} />;
  } else if (mentees.length <= 0) {
    content = <Empty description={"No mentorship found"} />
  } else {
    content = (
      <>
        {mentees.map((mentee) => {
          return (
            <Flex
              vertical={false}
              style={{
                width: "100%",
                gap: 8,
                borderBottom: "1px solid #e6e6e6",
                marginTop: 8,
                paddingBottom: 16,
              }}
            >
              <Flex vertical={true} style={{ gap: 4 }}>
                <Badge
                  username={mentee.alias}
                  name={mentee.givenName}
                  tenure={1}
                  size={"small"}
                />
              </Flex>
              <Space direction={"vertical"} style={{ width: "100%" }}>
                <Row gutter={8}>
                  <Col span={2}>
                    <Typography.Text
                      strong={true}
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Alias:
                    </Typography.Text>
                  </Col>
                  <Col span={3}>
                    <Typography.Text>{mentee.alias}</Typography.Text>
                  </Col>
                  <Col span={3}>
                    <Typography.Text
                      strong={true}
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Name:
                    </Typography.Text>
                  </Col>
                  <Col span={5}>
                    <Typography.Text>
                      {mentee.givenName} {mentee.surname} ({mentee.type})
                    </Typography.Text>
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={2}>
                    <Typography.Text
                      strong={true}
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Level:
                    </Typography.Text>
                  </Col>
                  <Col span={3}>
                    <Typography.Text>L{mentee.level}</Typography.Text>
                  </Col>
                  <Col span={3}>
                    <Typography.Text
                      strong={true}
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Department:
                    </Typography.Text>
                  </Col>
                  <Col span={5}>
                    <Typography.Text>{mentee.department}</Typography.Text>
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={3}>
                    <Typography.Text
                      strong={true}
                      style={{ display: "flex", justifyContent: "end" }}
                    >
                      Notes:
                    </Typography.Text>
                  </Col>
                  <Col span={21}>
                    <NoteHtmlDisplay value={mentee.notes} />
                  </Col>
                </Row>
              </Space>
            </Flex>
          );
        })}
      </>
    );
  }

  return (
    <Row>
      <Col span={24} className={"break"}>
        <SectionHeading title={"Mentorship"}>{content}</SectionHeading>
      </Col>
    </Row>
  );
};
export default MentorshipSection;
