import { Button, Space, Typography } from "antd";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import NoteSummaryRichTextEditor from "../../notes/NoteSummaryRitchTextEditor";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

export type NotesFormData = {
  notes: string;
};

const NotesPanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [notes, setNotes] = useState<string | undefined>(undefined);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState(false);

  const { handleSubmit, control, watch, reset, getValues } =
    useForm<NotesFormData>({ defaultValues: { notes: "" } });

  const loadForte = async (quiet: boolean = false) => {
    if (!quiet) {
      setNotesLoading(true);
    }

    setNotesError(false);

    try {
      const response = await themisApi.getNotes(username, year);
      setNotes(response.notes);
      reset(response);
    } catch (e) {
      setNotesError(true);
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadForte(false);
    })();
  }, [username, year]);

  const onSubmit = async (data: NotesFormData) => {
    try {
      await themisApi.upsertNotes(username, year, data.notes);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Notes saved",
        description: "Notes have been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save notes",
        description: "Unable to save notes due to a server error",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Space direction={"vertical"} size={16} style={{ width: "100%" }}>
        <Typography.Text strong={true}>Notes:</Typography.Text>
        <Controller
          name={"notes"}
          control={control}
          render={({ field: { onChange, value } }) => (
            <NoteSummaryRichTextEditor
              onChange={onChange}
              value={value}
              height={450}
            />
          )}
        />
        <Button type={"primary"} htmlType={"submit"} style={{ marginRight: 8 }}>
          Save
        </Button>
      </Space>
    </form>
  );
};
export default NotesPanel;
