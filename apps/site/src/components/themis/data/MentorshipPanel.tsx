import {Button, Empty, Result, Space} from "antd";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type { MentorshipResponse } from "../../../pages/api/themis/user/[username]/data/[year]/mentorship";
import type { Mentee } from "../../../types/themis";
import { publish } from "../../../utils/events";
import Loader from "../../common/Loader";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import MentorshipEntryRow from "../form/MentorshipEntryRow";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

export type MentorshipFormData = {
  mentorship: Mentee[];
};

const MentorshipPanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [mentorship, setMentorship] = useState<MentorshipResponse | undefined>(
    undefined,
  );
  const [mentorshipLoading, setMentorshipLoading] = useState(false);
  const [mentorshipError, setMentorshipError] = useState(false);

  const { handleSubmit, control, register, reset, watch } =
    useForm<MentorshipFormData>({
      defaultValues: { mentorship: [] },
    });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "mentorship",
  });
  const menteesWatch = watch("mentorship");

  const loadMentorship = async (quiet: boolean = false) => {
    if (!quiet) {
      setMentorshipLoading(true);
    }

    setMentorshipError(false);

    try {
      const response = await themisApi.data.getMentorship(username, year);
      setMentorship(response);
      reset(response);
    } catch (e) {
      setMentorshipError(true);
    } finally {
      setMentorshipLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadMentorship(false);
    })();
  }, [username, year]);

  const onSubmit = async (data: MentorshipFormData) => {
    try {
      await themisApi.data.upsertMentorship(username, year, data.mentorship);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Mentorship saved",
        description: "Mentorship have been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save mentorship",
        description: "Unable to save mentorship due to a server error",
      });
    }
  };

  const formRows = fields.map((field, index) => {
    return (
      <MentorshipEntryRow
        index={index}
        control={control}
        register={register}
        remove={remove}
        mentees={menteesWatch}
      />
    );
  });

  let content;

  if (mentorshipLoading) {
    content = <Loader />;
  } else if (mentorshipError) {
    content = <Result status={"error"} title={"Unable to load mentorship"} />;
  } else if (formRows.length <= 0) {
    content = <Empty description={"No mentorship found"} />;
  } else {
    content = formRows;
  }

  return (
    <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
      {content}
      <Space direction={"horizontal"} size={8}>
        <Button
          type={"primary"}
          onClick={async () => {
            await handleSubmit(onSubmit)();
          }}
        >
          Save
        </Button>
        <Button
          type={"default"}
          onClick={async () => {
            append({
              alias: "",
              type: "Peer",
              department: "",
              givenName: "",
              level: -1,
              notes: "",
              surname: "",
            });
          }}
        >
          Add Entry
        </Button>
      </Space>
    </Space>
  );
};
export default MentorshipPanel;
