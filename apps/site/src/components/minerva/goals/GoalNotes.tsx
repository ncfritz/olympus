import { PlusOutlined } from "@ant-design/icons";
import type { Goal, Note } from "@ncfritz/olympus-sdk/minerva";
import { Button, Empty, Skeleton } from "antd";
import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import notesApi from "../../../api/notestApi";
import { GOAL_NOTE_ITEM_TYPE } from "../../../utils/goals";
import { Events, publish } from "../../../utils/events";
import NotesEditorForm, {
  NEW_NOTE,
  type NotesFormInput,
} from "../../notes/NotesEditorForm";
import TimelineEntry from "../../notes/TimelineEntry";
import GoalSection from "./GoalSection";

/**
 * A goal's notes (ADR 0026: note_associations, item type goal): New note
 * opens the note editor in place, saving the note linked to the goal; the
 * goal's notes list below, newest first, each edited, flagged, deleted or
 * restored as on the Notes page.
 */
const GoalNotes: React.FunctionComponent<{
  goal: Goal;
  readOnly: boolean;
}> = ({ goal, readOnly }) => {
  const [notes, setNotes] = useState<Note[]>();
  const [writing, setWriting] = useState(false);
  const { handleSubmit, control, reset } = useForm<NotesFormInput>({
    defaultValues: NEW_NOTE,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const load = useCallback(async () => {
    try {
      const response = await notesApi.getNotesForEntity(
        GOAL_NOTE_ITEM_TYPE,
        goal.id,
      );
      setNotes(response.data.notes);
    } catch {
      setNotes([]);
      publish(Events.NOTIFICATIONS_PUBLISH_EVENT, {
        type: "error",
        message: "Could not load the goal's notes",
      });
    }
  }, [goal.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = async () => {
    await load();
  };

  return (
    <GoalSection
      title={`Notes · ${notes?.length ?? 0}`}
      extra={
        !readOnly &&
        !writing && (
          <Button
            type={"text"}
            size={"small"}
            icon={<PlusOutlined />}
            onClick={() => setWriting(true)}
          >
            New note
          </Button>
        )
      }
    >
      {writing && (
        <NotesEditorForm
          onClose={() => setWriting(false)}
          beforeCreate={(candidate) => ({
            ...candidate,
            associations: [{ itemId: goal.id, itemType: GOAL_NOTE_ITEM_TYPE }],
          })}
          afterCreate={changed}
          formControl={{ control, reset, handleSubmit }}
          mainEditorHeight={240}
          showTitle={false}
          showSummary={false}
          style={{ marginBottom: 16 }}
        />
      )}
      {notes === undefined ? (
        <Skeleton active={true} paragraph={{ rows: 2 }} />
      ) : notes.length === 0 ? (
        !writing && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={"No notes on this goal yet"}
          />
        )
      ) : (
        notes.map((note) => (
          <TimelineEntry
            key={note.id}
            item={note}
            showMetadata={false}
            showAssociations={false}
            showEditorTitle={false}
            showEditorSummary={false}
            deleteCallback={changed}
            restoreCallback={changed}
            updateCallback={changed}
            updateFlagCallback={changed}
            leftMargin={0}
          />
        ))
      )}
    </GoalSection>
  );
};

export default GoalNotes;
