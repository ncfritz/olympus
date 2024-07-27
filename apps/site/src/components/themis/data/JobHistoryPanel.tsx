import { Button, Col, Empty, Row, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import themisApi from "../../../api/themisApi";
import type { JobHistoryEntry } from "../../../types/themis";
import { publish } from "../../../utils/events";
import { PUBLISH_EVENT } from "../../common/NotificationSink";
import ImportJobHistoryModal from "../form/ImportJobHistoryModal";
import JobHistoryEntryRow from "../form/JobHistoryEntryRow";
import JobHistoryGraph from "../graph/JobHistoryGraph";
import type { UserDataTabPanelProps } from "./UserDataTabGroup";

export type JobHistoryFormData = {
  entries: JobHistoryEntry[];
};

export const EMPTY_JOB_HISTORY_ENTRY = {
  jobTitle: "",
  start: "2024-05-04",
  end: undefined,
  level: -1,
  fte: false,
};

const JobHistoryPanel: React.FunctionComponent<UserDataTabPanelProps> = ({
  username,
  year,
  afterSave,
}) => {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [jobHistory, setJobHistory] = useState<JobHistoryEntry[] | undefined>(
    [],
  );
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false);
  const [jobHistoryError, setJobHistoryError] = useState(false);

  const { handleSubmit, control, register, reset, getValues } =
    useForm<JobHistoryFormData>();
  const { fields, append, prepend, remove, swap, move, insert } = useFieldArray(
    {
      control,
      name: "entries",
    },
  );

  const loadJobHistory = async (quiet: boolean = false) => {
    if (!quiet) {
      setJobHistoryLoading(true);
    }

    setJobHistoryError(false);

    try {
      const response = await themisApi.getJobHistory(username, year);
      setJobHistory(response.entries);
      reset(response);
    } catch (e) {
      setJobHistoryError(true);
    } finally {
      setJobHistoryLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadJobHistory(false);
    })();
  }, [username, year]);

  const onSubmit = async (data: JobHistoryFormData) => {
    try {
      await themisApi.upsertJobHistory(username, year, data.entries);

      publish(PUBLISH_EVENT, {
        type: "success",
        message: "Job history saved",
        description: "Job history has been successfully saved",
      });

      await afterSave();
    } catch (e) {
      publish(PUBLISH_EVENT, {
        type: "error",
        message: "Failed to save job history",
        description: "Unable to save job history due to a server error",
      });
    }
  };

  let formRows;

  if (fields.length <= 0) {
    formRows = (
      <Row>
        <Col span={18}>
          <Empty description={"No job history has been added"}>
            <Button
              type={"primary"}
              onClick={() => {
                append(EMPTY_JOB_HISTORY_ENTRY);
              }}
            >
              Add job history
            </Button>
          </Empty>
        </Col>
      </Row>
    );
  } else {
    formRows = fields.map((field, index) => {
      return (
        <JobHistoryEntryRow
          index={index}
          count={fields.length}
          control={control}
          register={register}
          formActions={{
            append: append,
            prepend: prepend,
            remove: remove,
          }}
        />
      );
    });
  }

  return (
    <Space direction={"vertical"} size={0} style={{ width: "100%" }}>
      <Row gutter={8}>
        <Col span={18}>
          <JobHistoryGraph data={getValues().entries || []} />
        </Col>
      </Row>
      <Row gutter={8} style={{ marginTop: 16 }}>
        <Col span={5}>
          <Typography.Text strong={true}>Job Title</Typography.Text>
        </Col>
        <Col span={4}>
          <Typography.Text strong={true}>Start Date</Typography.Text>
        </Col>
        <Col span={4}>
          <Typography.Text strong={true}>End Date</Typography.Text>
        </Col>
        <Col span={2}>
          <Typography.Text strong={true}>Level</Typography.Text>
        </Col>
        <Col span={1}>
          <Typography.Text strong={true}>FTE</Typography.Text>
        </Col>
        <Col span={2}></Col>
      </Row>
      {formRows}
      <Row gutter={8}>
        <Col span={5}>
          <Space direction={"horizontal"} size={8}>
            <Button
              type={"primary"}
              onClick={() => {
                handleSubmit(onSubmit)();
              }}
            >
              Save
            </Button>
            <Button
              type={"default"}
              onClick={() => {
                setImportModalOpen(true);
              }}
            >
              Import
            </Button>
          </Space>
        </Col>
      </Row>
      <ImportJobHistoryModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
        }}
        importFunction={async (history) => {
          reset({ entries: history });
        }}
      />
    </Space>
  );
};
export default JobHistoryPanel;
