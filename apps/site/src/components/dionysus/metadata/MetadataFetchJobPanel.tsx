import type {
  MetadataJobType,
  MetadataFetchJob,
} from "@ncfritz/olympus-sdk/dionysus";
import { Alert, Empty, notification, Space, Spin } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import metadataApi from "../../../api/metadataApi";
import type { NotificationType } from "../../../utils/notifications";
import MetadataFetchJobDetailsPanel from "../jobs/MetadataFetchJobDetailsPanel";

export interface MetadataFetchJobPanelProps {
  id: string | number;
  type: MetadataJobType;
}

const MetadataFetchJobPanel: React.FunctionComponent<
  MetadataFetchJobPanelProps
> = ({ id, type }: MetadataFetchJobPanelProps) => {
  const [api] = notification.useNotification();

  const [job, setJob] = useState<MetadataFetchJob | undefined>(undefined);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState<Error | undefined>(undefined);

  const fetchMetadataFetchJob = async (quiet = false) => {
    if (!quiet) {
      setJobLoading(true);
    }
    setJobError(undefined);

    try {
      const describeMetadataFetchJob =
        await metadataApi.describeMetadataFetchJob(id as string, type);
      setJob(describeMetadataFetchJob.data.job);
    } catch (e) {
      setJobError(e);
      openNotificationWithIcon(
        "error",
        "Unable to load metadata fetch job",
        "Poop",
      );
    } finally {
      setJobLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchMetadataFetchJob(false);
    })();
  }, [id, type]);

  const openNotificationWithIcon = (
    type: NotificationType,
    message: string,
    content: ReactNode,
  ) => {
    api[type]({
      message: message,
      description: content,
    });
  };

  let content;

  if (jobLoading) {
    content = (
      <Space style={{ width: "100%", margin: 32 }}>
        <Spin size={"large"} />
      </Space>
    );
  } else if (jobError) {
    content = (
      <Alert type={"error"} description={"Unable to load MetadataFetchJob"} />
    );
  } else if (!job) {
    content = <Empty />;
  } else {
    content = (
      <MetadataFetchJobDetailsPanel
        job={job}
        close={() => {}}
        postUpdate={async () => {
          await fetchMetadataFetchJob(true);
        }}
      />
    );
  }

  return content;
};
export default MetadataFetchJobPanel;
