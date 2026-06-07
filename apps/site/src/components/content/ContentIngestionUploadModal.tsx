import { InboxOutlined } from "@ant-design/icons";
import { Button, Modal, Space, Typography, type UploadFile } from "antd";
import Dragger from "antd/lib/upload/Dragger";
import React, { useState } from "react";
import { flushSync } from "react-dom";

export interface ContentIngestionUploadModalProps {
  isOpen: boolean;
  onUploadsComplete?: () => Promise<void>;
  close: () => void;
}

const ContentIngestionUploadModal: React.FunctionComponent<
  ContentIngestionUploadModalProps
> = ({
  isOpen,
  close,
  onUploadsComplete,
}: ContentIngestionUploadModalProps) => {
  const [uploadsProcessing, setUploadsProcessing] = useState(false);
  const [uploads, setUploads] = useState<UploadFile[]>([]);

  return (
    <Modal
      open={isOpen}
      title={"Upload Assets to Ingest"}
      maskClosable={!uploadsProcessing}
      onCancel={() => {
        close();
      }}
      width={1250}
      footer={
        <Space orientation={"horizontal"}>
          <Button
            type={"primary"}
            onClick={() => {
              close();
            }}
            disabled={uploadsProcessing}
          >
            Close
          </Button>
        </Space>
      }
    >
      <Dragger
        action={"/api/v1/dionysus/content/upload"}
        name={"files"}
        showUploadList={true}
        listType={"text"}
        maxCount={100}
        fileList={uploads}
        multiple={true}
        beforeUpload={async (file) => {
          setUploadsProcessing(true);
          return file;
        }}
        onChange={async (info) => {
          let newFiles = info.fileList;

          if (info.file.status === "done") {
            newFiles = info.fileList.filter((obj) => {
              return obj.uid !== info.file.uid;
            });
          }

          flushSync(() => {
            setUploads(newFiles);
          });

          const allUploadsComplete = newFiles.every(
            (file) => file.status === "done" || file.status === "error",
          );

          if (allUploadsComplete) {
            setUploadsProcessing(false);

            if (onUploadsComplete) {
              await onUploadsComplete();
            }
            close();
          }
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <Typography.Text>
          Click or drag files to this area to upload
        </Typography.Text>
      </Dragger>
    </Modal>
  );
};
export default ContentIngestionUploadModal;
