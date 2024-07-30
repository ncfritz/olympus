import { Col, Empty, Result, Row, Space, Spin } from "antd";
import React, { useEffect, useState } from "react";
import themisApi from "../../../api/themisApi";
import NoteHtmlDisplay from "../../notes/NoteHtmlDisplay";
import NotesPanel from "../data/NotesPanel";
import SectionHeading from "./SectionHeading";

export interface NotesSectionProps {
  username: string;
  year: string;
}

const NotesSection: React.FunctionComponent<NotesSectionProps> = ({
  username,
  year,
}: NotesSectionProps) => {
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<any>();
  const [error, setError] = useState<any>();
  const [editing, setEditing] = useState(false);

  const loadNotes = async (quite = false) => {
    if (!quite) {
      setLoading(true);
    }

    try {
      setError(undefined);

      const response = await themisApi.review.getNotes(username, year);
      setNotes(response.notes);
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

  let content;

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
  } else if (editing) {
    content = (
      <NotesPanel
        username={username}
        year={year}
        afterSave={async () => {
          await loadNotes(true);
          setEditing(false);
        }}
      />
    );
  } else {
    if (!notes || notes.trim() === "") {
      content = <Empty description={"No review notes found"} />;
    } else {
      content = <NoteHtmlDisplay value={notes} />;
    }
  }

  return (
    <Row>
      <Col span={24} className={"break"}>
        <SectionHeading
          title={"Notes"}
          editing={editing}
          onEdit={() => {
            setEditing(true);
          }}
        >
          {content}
        </SectionHeading>
      </Col>
    </Row>
  );
};
export default NotesSection;
