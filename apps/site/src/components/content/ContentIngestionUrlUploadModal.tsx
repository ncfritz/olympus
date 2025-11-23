import {
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  Loading3QuartersOutlined,
  SafetyOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Button, Modal, Space, Typography, Input } from "antd";
import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import contentApi from "../../api/contentApi";

const { TextArea } = Input;

export interface ContentIngestionUrlUploadModalProps {
  isOpen: boolean;
  onUploadsComplete?: () => Promise<void>;
  close: () => void;
}

type UrlUploadStatus = "waiting" | "processing" | "done" | "error";
interface UrlUpload {
  url: string;
  status: UrlUploadStatus;
  uid: string;
}

const ContentIngestionUrlUploadModal: React.FunctionComponent<
  ContentIngestionUrlUploadModalProps
> = ({
  isOpen,
  close,
  onUploadsComplete,
}: ContentIngestionUrlUploadModalProps) => {
  const [urlsProcessing, setUrlsProcessing] = useState(false);
  const [urlsInput, setUrlsInput] = useState("");
  const [toProcess, setToProcess] = useState<Map<string, UrlUpload>>(new Map());
  const [urlsValidated, setUrlsValidated] = useState(false);

  const preProcessUrls = () => {
    setUrlsProcessing(true);
    const parsedInput: Map<string, UrlUpload> = new Map();

    urlsInput.split("\n").forEach((value) => {
      const id = uuidv4();
      let status: UrlUploadStatus = "waiting";

      try {
        new URL(value);
      } catch (e) {
        status = "error";
      }

      parsedInput.set(id, {
        url: value,
        status: status,
        uid: id,
      });
    });
    setToProcess(parsedInput);
    setUrlsProcessing(false);
    setUrlsValidated(true);
  };

  const onClose = () => {
    setToProcess(new Map());
    setUrlsValidated(false);
    setUrlsInput("");
    setUrlsProcessing(false);
    close();
  };

  const processUrls = async () => {
    setUrlsProcessing(true);
    const workQueue = toProcess.values().toArray();
    let newUrls = new Map(toProcess);

    for (const value of workQueue) {
      newUrls = new Map(toProcess);

      if (value.status === "error" || value.status === "done") {
        return;
      }

      try {
        newUrls.get(value.uid)!.status = "processing";
        setToProcess(newUrls);

        await contentApi.createContentIngestionWorkflow(value.url, "remote");
        await new Promise((resolve) => setTimeout(resolve, 900));

        newUrls.get(value.uid)!.status = "done";
      } catch (e) {
        newUrls.get(value.uid)!.status = "error";
      } finally {
        setToProcess(newUrls);
      }
    }

    setToProcess(newUrls);
    setUrlsProcessing(false);

    if (onUploadsComplete) {
      await onUploadsComplete();
    }

    onClose();
  };

  return (
    <Modal
      open={isOpen}
      title={"Upload Asset URLs to Fetch/Ingest"}
      maskClosable={!urlsProcessing}
      onCancel={() => {
        onClose();
      }}
      width={1250}
      footer={
        <Space
          direction={"horizontal"}
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          {(!urlsValidated || toProcess.size <= 0) && !urlsProcessing ? (
            <Button
              color={"cyan"}
              variant={"solid"}
              onClick={() => {
                preProcessUrls();
              }}
              disabled={urlsProcessing || !urlsInput.trim()}
              icon={<SafetyOutlined />}
            >
              Validate URLs
            </Button>
          ) : (
            <Space direction={"horizontal"} size={8}>
              <Button
                color={"magenta"}
                variant={"solid"}
                onClick={async () => {
                  await processUrls();
                }}
                disabled={
                  urlsProcessing ||
                  toProcess
                    .values()
                    .toArray()
                    .filter((v) => v.status === "waiting").length <= 0
                }
                icon={<UploadOutlined />}
              >
                Upload URLs
              </Button>
              <Button
                color={"primary"}
                variant={"text"}
                onClick={() => {
                  setToProcess(new Map());
                  setUrlsValidated(false);
                }}
                disabled={urlsProcessing}
                icon={<EditOutlined />}
              >
                Edit URLs
              </Button>
            </Space>
          )}
          <Button
            type={"primary"}
            onClick={() => {
              onClose();
            }}
            disabled={urlsProcessing}
          >
            Close
          </Button>
        </Space>
      }
    >
      <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
        {(!urlsValidated || toProcess.size <= 0) && !urlsProcessing && (
          <TextArea
            rows={4}
            styles={{
              textarea: {
                fontFamily: "monospace",
                maxHeight: 250,
              },
            }}
            value={urlsInput}
            onChange={(e) => {
              setUrlsInput(e.target.value);
            }}
            disabled={urlsProcessing}
          />
        )}
        <Space
          size={4}
          direction={"vertical"}
          style={{
            width: "100%",
            maxHeight: 450,
            overflow: "scroll",
          }}
        >
          {toProcess
            .values()
            .toArray()
            .map((value) => {
              let textColor = "#1677ff";

              if (value.status === "error") {
                textColor = "#ff4d4f";
              }

              let icon = (
                <LinkOutlined
                  style={{
                    color: value.status === "error" ? textColor : "#8c8c8c",
                  }}
                />
              );

              if (value.status === "done") {
                icon = <CheckCircleFilled style={{ color: "#8c8c8c" }} />;
              } else if (value.status === "processing") {
                icon = (
                  <Loading3QuartersOutlined
                    spin={true}
                    style={{ color: "#8c8c8c" }}
                  />
                );
              }

              return (
                <Space
                  key={uuidv4()}
                  direction={"horizontal"}
                  size={8}
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Space
                    direction={"horizontal"}
                    size={8}
                    style={{ width: "100%" }}
                  >
                    {icon}
                    <Typography.Text style={{ color: textColor }}>
                      {value.url}
                    </Typography.Text>
                  </Space>
                  <Button
                    type={"text"}
                    danger={true}
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      const newUrls = new Map(toProcess);
                      newUrls.delete(value.uid);
                      setToProcess(newUrls);
                    }}
                    disabled={urlsProcessing}
                  ></Button>
                </Space>
              );
            })}
        </Space>
      </Space>
    </Modal>
  );
};
export default ContentIngestionUrlUploadModal;
